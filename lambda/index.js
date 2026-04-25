const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const rds = new RDSDataClient({ region: process.env.AWS_REGION || "us-east-1" });
const DB = { resourceArn: process.env.AURORA_CLUSTER_ARN, secretArn: process.env.AURORA_SECRET_ARN, database: process.env.DB_NAME || "uniprofile" };
const verifier = CognitoJwtVerifier.create({ userPoolId: process.env.COGNITO_USER_POOL_ID, tokenUse: "access", clientId: process.env.COGNITO_CLIENT_ID });
async function sql(query, params = []) {
  try { const res = await rds.send(new ExecuteStatementCommand({ ...DB, sql: query, parameters: params, formatRecordsAs: "JSON" })); return res.formattedRecords ? JSON.parse(res.formattedRecords) : []; }
  catch (e) { console.error("SQL Error:", e.message, "Q:", query.slice(0,100)); throw e; }
}
const uuidParam=(n,v)=>({name:n,value:{stringValue:v},typeHint:"UUID"});
const strParam=(n,v)=>({name:n,value:(v!=null&&v!==''&&v!=='null')?{stringValue:String(v)}:{isNull:true}});
const boolParam=(n,v)=>({name:n,value:v!=null?{booleanValue:Boolean(v)}:{isNull:true}});
const numParam=(n,v)=>({name:n,value:v!=null?{doubleValue:Number(v)}:{isNull:true}});
const dateParam=(n,v)=>(v&&v!==''&&v!=='null')?{name:n,value:{stringValue:String(v)},typeHint:"DATE"}:{name:n,value:{isNull:true}};
const ORIGINS=["https://www.uniprofile.net","https://main.d3dngzji06baij.amplifyapp.com","http://localhost:3000","http://localhost:5173"];
const cors=(o)=>{const a=ORIGINS.includes(o)?o:ORIGINS[0];return{"Content-Type":"application/json","Access-Control-Allow-Origin":a,"Access-Control-Allow-Headers":"Content-Type,Authorization,x-uniprofile-key","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Credentials":"true"};};
const go=(e)=>(e.headers&&(e.headers.origin||e.headers.Origin))||"";
const ok=(b,e,s=200)=>({statusCode:s,headers:cors(go(e)),body:JSON.stringify(b)});
const err=(m,e,s=400)=>({statusCode:s,headers:cors(go(e)),body:JSON.stringify({error:m})});
async function verifyToken(event){
  const auth=(event.headers&&(event.headers.Authorization||event.headers.authorization))||"";
  if(!auth.startsWith("Bearer ")) throw {status:401,message:"Authentication required"};
  try{return await verifier.verify(auth.slice(7));}catch(e){throw {status:401,message:"Invalid or expired token"};}
}
async function getOrCreateTraveler(sub,email){
  let rows=await sql("SELECT uuid FROM travelers WHERE cognito_sub=:sub",[strParam("sub",sub)]);
  if(rows.length)return rows[0].uuid;
  rows=await sql("INSERT INTO travelers (cognito_sub,email,tier,gdpr_consent_at,uniprofile_number) VALUES (:sub,:email,'free',NOW(),'UP-'||LPAD(FLOOR(RANDOM()*1000000)::TEXT,6,'0')) ON CONFLICT (cognito_sub) DO UPDATE SET email=:email RETURNING uuid",[strParam("sub",sub),strParam("email",email||"")]);
  return rows[0]&&rows[0].uuid;
}
async function buildProfile(uuid){
  const p=[uuidParam("u",uuid)];
  const R=await Promise.all([
    sql("SELECT legal_first,legal_middle,legal_last,dob,nationality,gender_code,home_airport FROM traveler_identity WHERE traveler_uuid=:u",p),
    sql("SELECT id,doc_type,doc_number,given_names,surname,issuing_country,nationality,dob,gender_code,issue_date,expiry_date,place_of_birth,visa_type,destination_country,entries,valid_from,valid_until,port_of_entry,pr_category,pr_conditions,esta_application_number,esta_status,doc_notes,is_primary FROM travel_documents WHERE traveler_uuid=:u ORDER BY is_primary DESC",p),
    sql("SELECT cabin_domestic,cabin_international,seat_position,row_preference,avoid_last_row,avoid_middle_seats,wheelchair_needed,hotel_room_type,hotel_floor_pref,car_type_pref FROM seat_preferences WHERE traveler_uuid=:u",p),
    sql("SELECT primary_meal_code,beverage_pref,allergies,avoid_items,dietary_notes FROM meal_preferences WHERE traveler_uuid=:u",p),
    sql("SELECT id,program_type,provider_name,program_name,member_number,tier_status,tier_expires,auto_apply,linked_card_type,linked_card_last4,points_balance,notes FROM loyalty_memberships WHERE traveler_uuid=:u AND is_active=TRUE ORDER BY program_type,provider_name",p),
    sql("SELECT active_context,last_switched_at FROM bleisure_context WHERE traveler_uuid=:u",p),
    sql("SELECT profile_complete,tier,email,uniprofile_number FROM travelers WHERE uuid=:u",p),
    sql("SELECT context,preferred_card,company_name,cost_center,policy_description,expense_platform,corporate_card FROM payment_profiles WHERE traveler_uuid=:u ORDER BY context",p),
    sql("SELECT id,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,status,total_fare,currency,source_platform,notes FROM trips WHERE traveler_uuid=:u ORDER BY departure_date DESC LIMIT 50",p),
    sql("SELECT s.trip_id,s.id,s.segment_type,s.segment_order,s.carrier,s.flight_number,s.origin_iata,s.destination_iata,s.departure_datetime,s.arrival_datetime,s.cabin_class,s.seat_number,s.booking_ref,s.duration_minutes,s.aircraft_type FROM trip_segments s INNER JOIN trips t ON t.id=s.trip_id WHERE t.traveler_uuid=:u ORDER BY s.trip_id,s.segment_order",p),
    sql("SELECT ps.trip_id,ps.passenger_name,ps.ticket_number,ps.seat_number,ps.is_primary FROM trip_passengers ps INNER JOIN trips t ON t.id=ps.trip_id WHERE t.traveler_uuid=:u ORDER BY ps.trip_id,ps.is_primary DESC",p),
    sql("SELECT code,label,category,sort_order,fields_required,fields_optional FROM document_types WHERE is_active=TRUE ORDER BY sort_order",[]),
    sql("SELECT id,name,type,destination,dep::text,ret::text,members,flights,hotel,notes FROM traveler_groups WHERE owner_uuid=:u ORDER BY updated_at DESC",p),
  ]);
  const [identity,docs,seat,meal,loyalty,bleisure,meta,payment,tripRows,segmentRows,passengerRows,docTypeRows,groupRows]=R;
  let mealData=meal[0]||null;
  if(mealData){
    try{mealData.allergies=typeof mealData.allergies==="string"?JSON.parse(mealData.allergies):(mealData.allergies||[]);}catch(e){mealData.allergies=[];}
    try{mealData.avoid_items=typeof mealData.avoid_items==="string"?JSON.parse(mealData.avoid_items):(mealData.avoid_items||[]);}catch(e){mealData.avoid_items=[];}
  }
  const now=new Date();
  const docsWithExpiry=docs.map(d=>Object.assign({},d,{days_remaining:d.expiry_date?Math.floor((new Date(d.expiry_date)-now)/86400000):null}));
  const docTypesGrouped={};
  docTypeRows.forEach(dt=>{
    if(!docTypesGrouped[dt.category])docTypesGrouped[dt.category]=[];
    docTypesGrouped[dt.category].push({code:dt.code,label:dt.label,sort_order:dt.sort_order,
      fields_required:typeof dt.fields_required==="string"?JSON.parse(dt.fields_required):(dt.fields_required||[]),
      fields_optional:typeof dt.fields_optional==="string"?JSON.parse(dt.fields_optional):(dt.fields_optional||[])});
  });
  const segsByTrip={};
  segmentRows.forEach(s=>{if(!segsByTrip[s.trip_id])segsByTrip[s.trip_id]=[];segsByTrip[s.trip_id].push(s);});
  const paxByTrip={};
  passengerRows.forEach(p=>{if(!paxByTrip[p.trip_id])paxByTrip[p.trip_id]=[];paxByTrip[p.trip_id].push(p);});
  const trips=tripRows.map(t=>{
    const dep=t.departure_date?new Date(t.departure_date):null;
    const ret=t.return_date?new Date(t.return_date):null;
    const daysUntil=dep?Math.floor((dep-now)/86400000):null;
    const status=!dep?"unknown":daysUntil>0?"upcoming":ret&&now<=ret?"in-progress":"completed";
    return Object.assign({},t,{days_until:daysUntil,status,segments:segsByTrip[t.id]||[],passengers:paxByTrip[t.id]||[]});
  });
  const groups=groupRows.map(g=>({id:g.id,name:g.name,type:g.type,destination:g.destination,dep:g.dep,ret:g.ret,members:typeof g.members==="string"?JSON.parse(g.members):(g.members||[]),flights:typeof g.flights==="string"?JSON.parse(g.flights):(g.flights||[]),hotel:g.hotel?(typeof g.hotel==="string"?JSON.parse(g.hotel):g.hotel):null,notes:typeof g.notes==="string"?JSON.parse(g.notes):(g.notes||[])}));
  return {uuid,uniprofile_number:meta[0]&&meta[0].uniprofile_number||null,email:meta[0]&&meta[0].email,tier:meta[0]&&meta[0].tier||"free",profile_completeness:meta[0]&&meta[0].profile_complete||0,active_context:bleisure[0]&&bleisure[0].active_context||"PERSONAL",identity:identity[0]||null,documents:docsWithExpiry,document_types:docTypesGrouped,seat_preferences:seat[0]||null,meal_preferences:mealData,loyalty_programs:loyalty,payment_profiles:payment,trips,trips_count:trips.length,groups,generated_at:new Date().toISOString()};
}
async function updateModule(uuid,module,data){
  switch(module){
    case "identity":
      await sql("INSERT INTO traveler_identity (traveler_uuid,legal_first,legal_middle,legal_last,dob,nationality,gender_code,home_airport) VALUES (:u,:f,:m,:l,:dob,:nat,:gen,:hap) ON CONFLICT (traveler_uuid) DO UPDATE SET legal_first=:f,legal_middle=:m,legal_last=:l,dob=:dob,nationality=:nat,gender_code=:gen,home_airport=:hap,updated_at=NOW()",[uuidParam("u",uuid),strParam("f",data.legal_first),strParam("m",data.legal_middle),strParam("l",data.legal_last),dateParam("dob",data.dob),strParam("nat",data.nationality),strParam("gen",data.gender_code),strParam("hap",data.home_airport&&data.home_airport.toUpperCase().slice(0,3))]);
      break;
    case "seat_preferences":
      await sql("INSERT INTO seat_preferences (traveler_uuid,cabin_domestic,cabin_international,seat_position,row_preference,avoid_last_row,avoid_middle_seats,wheelchair_needed,hotel_room_type,hotel_floor_pref,car_type_pref) VALUES (:u,:cd,:ci,:sp,:rp,:alr,:ams,:wc,:hrt,:hfp,:ct) ON CONFLICT (traveler_uuid) DO UPDATE SET cabin_domestic=:cd,cabin_international=:ci,seat_position=:sp,row_preference=:rp,avoid_last_row=:alr,avoid_middle_seats=:ams,wheelchair_needed=:wc,hotel_room_type=:hrt,hotel_floor_pref=:hfp,car_type_pref=:ct,updated_at=NOW()",[uuidParam("u",uuid),strParam("cd",data.cabin_domestic),strParam("ci",data.cabin_international),strParam("sp",data.seat_position),strParam("rp",data.row_preference),boolParam("alr",data.avoid_last_row),boolParam("ams",data.avoid_middle_seats),boolParam("wc",data.wheelchair_needed),strParam("hrt",data.hotel_room_type),strParam("hfp",data.hotel_floor_pref),strParam("ct",data.car_type_pref)]);
      break;
    case "meal_preferences":
      await sql("INSERT INTO meal_preferences (traveler_uuid,primary_meal_code,beverage_pref,allergies,avoid_items,dietary_notes) VALUES (:u,:mc,:bp,:al::jsonb,:av::jsonb,:dn) ON CONFLICT (traveler_uuid) DO UPDATE SET primary_meal_code=:mc,beverage_pref=:bp,allergies=:al::jsonb,avoid_items=:av::jsonb,dietary_notes=:dn,updated_at=NOW()",[uuidParam("u",uuid),strParam("mc",data.primary_meal_code),strParam("bp",data.beverage_pref),strParam("al",JSON.stringify(data.allergies||[])),strParam("av",JSON.stringify(data.avoid_items||[])),strParam("dn",data.dietary_notes)]);
      break;
    case "payment_personal":
      await sql("INSERT INTO payment_profiles (traveler_uuid,context,preferred_card) VALUES (:u,'PERSONAL',:card) ON CONFLICT (traveler_uuid,context) DO UPDATE SET preferred_card=:card,updated_at=NOW()",[uuidParam("u",uuid),strParam("card",data.preferred_card)]);
      break;
    case "payment_corporate":
      await sql("INSERT INTO payment_profiles (traveler_uuid,context,company_name,cost_center,policy_description,expense_platform,corporate_card) VALUES (:u,'CORPORATE',:cn,:cc,:pd,:ep,:corp) ON CONFLICT (traveler_uuid,context) DO UPDATE SET company_name=:cn,cost_center=:cc,policy_description=:pd,expense_platform=:ep,corporate_card=:corp,updated_at=NOW()",[uuidParam("u",uuid),strParam("cn",data.company_name),strParam("cc",data.cost_center),strParam("pd",data.policy_description),strParam("ep",data.expense_platform),strParam("corp",data.corporate_card)]);
      break;
    case "trip_context":
      await sql("UPDATE trips SET trip_context=:ctx,updated_at=NOW() WHERE id=:id AND traveler_uuid=:u",[strParam("ctx",data.context),strParam("id",data.trip_id),uuidParam("u",uuid)]);
      break;
    case "document_add":
      await sql("INSERT INTO travel_documents (traveler_uuid,doc_type,doc_number,given_names,surname,issuing_country,nationality,dob,gender_code,issue_date,expiry_date,place_of_birth,visa_type,destination_country,entries,valid_from,valid_until,port_of_entry,pr_category,pr_conditions,esta_application_number,esta_status,doc_notes,is_primary) VALUES (:u,:dt,:dn,:gn,:sn,:ic,:nat,:dob,:gen,:id,:ed,:pb,:vt,:dc,:en,:vf,:vu,:pe,:prc,:prcn,:ean,:es,:notes,:pri)",[uuidParam("u",uuid),strParam("dt",data.doc_type),strParam("dn",data.doc_number),strParam("gn",data.given_names),strParam("sn",data.surname),strParam("ic",data.issuing_country),strParam("nat",data.nationality),dateParam("dob",data.dob),strParam("gen",data.gender_code),dateParam("id",data.issue_date),dateParam("ed",data.expiry_date),strParam("pb",data.place_of_birth),strParam("vt",data.visa_type),strParam("dc",data.destination_country),strParam("en",data.entries),dateParam("vf",data.valid_from),dateParam("vu",data.valid_until),strParam("pe",data.port_of_entry),strParam("prc",data.pr_category),strParam("prcn",data.pr_conditions),strParam("ean",data.esta_application_number),strParam("es",data.esta_status),strParam("notes",data.doc_notes),boolParam("pri",data.is_primary||false)]);
      break;
    case "document_update":
      await sql("UPDATE travel_documents SET doc_number=:dn,given_names=:gn,surname=:sn,issuing_country=:ic,nationality=:nat,dob=:dob,gender_code=:gen,issue_date=:id,expiry_date=:ed,place_of_birth=:pb,visa_type=:vt,destination_country=:dc,entries=:en,valid_from=:vf,valid_until=:vu,port_of_entry=:pe,pr_category=:prc,pr_conditions=:prcn,esta_application_number=:ean,esta_status=:es,doc_notes=:notes,is_primary=:pri,updated_at=NOW() WHERE id=:did AND traveler_uuid=:u",[strParam("dn",data.doc_number),strParam("gn",data.given_names),strParam("sn",data.surname),strParam("ic",data.issuing_country),strParam("nat",data.nationality),dateParam("dob",data.dob),strParam("gen",data.gender_code),dateParam("id",data.issue_date),dateParam("ed",data.expiry_date),strParam("pb",data.place_of_birth),strParam("vt",data.visa_type),strParam("dc",data.destination_country),strParam("en",data.entries),dateParam("vf",data.valid_from),dateParam("vu",data.valid_until),strParam("pe",data.port_of_entry),strParam("prc",data.pr_category),strParam("prcn",data.pr_conditions),strParam("ean",data.esta_application_number),strParam("es",data.esta_status),strParam("notes",data.doc_notes),boolParam("pri",data.is_primary||false),uuidParam("did",data.doc_id),uuidParam("u",uuid)]);
      break;
    case "document_delete":
      await sql("DELETE FROM travel_documents WHERE id=:did AND traveler_uuid=:u",[uuidParam("did",data.doc_id),uuidParam("u",uuid)]);
      break;
    case "loyalty_add":
      await sql("INSERT INTO loyalty_memberships (traveler_uuid,program_type,provider_name,program_name,member_number,tier_status,tier_expires,auto_apply,linked_card_type,linked_card_last4,points_balance,notes) VALUES (:u,:pt,:pn,:pgn,:mn,:ts,:te,:aa,:lct,:lcl4,:pb,:notes)",[uuidParam("u",uuid),strParam("pt",data.program_type),strParam("pn",data.provider_name),strParam("pgn",data.program_name),strParam("mn",data.member_number),strParam("ts",data.tier_status),dateParam("te",data.tier_expires),boolParam("aa",data.auto_apply!==false),strParam("lct",data.linked_card_type),strParam("lcl4",data.linked_card_last4),numParam("pb",data.points_balance),strParam("notes",data.notes)]);
      break;
    case "loyalty_update":
      await sql("UPDATE loyalty_memberships SET program_type=:pt,provider_name=:pn,program_name=:pgn,member_number=:mn,tier_status=:ts,tier_expires=:te,auto_apply=:aa,linked_card_type=:lct,linked_card_last4=:lcl4,points_balance=:pb,notes=:notes,updated_at=NOW() WHERE id=:lid AND traveler_uuid=:u",[strParam("pt",data.program_type),strParam("pn",data.provider_name),strParam("pgn",data.program_name),strParam("mn",data.member_number),strParam("ts",data.tier_status),dateParam("te",data.tier_expires),boolParam("aa",data.auto_apply),strParam("lct",data.linked_card_type),strParam("lcl4",data.linked_card_last4),numParam("pb",data.points_balance),strParam("notes",data.notes),uuidParam("lid",data.loyalty_id),uuidParam("u",uuid)]);
      break;
    case "loyalty_delete":
      await sql("UPDATE loyalty_memberships SET is_active=FALSE WHERE id=:lid AND traveler_uuid=:u",[uuidParam("lid",data.loyalty_id),uuidParam("u",uuid)]);
      break;
    case "trip_delete":
      await sql("DELETE FROM trips WHERE id=:tid AND traveler_uuid=:u",[uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      break;
    case "groups":{
      const groups=Array.isArray(data.groups)?data.groups:[];
      await sql("DELETE FROM traveler_groups WHERE owner_uuid=:u",[uuidParam("u",uuid)]);
      for(const g of groups){
        if(!g.id)continue;
        await sql("INSERT INTO traveler_groups (id,owner_uuid,name,type,destination,dep,ret,members,flights,hotel,notes,updated_at) VALUES (:id,:u,:name,:type,:dest,:dep,:ret,:members::jsonb,:flights::jsonb,:hotel::jsonb,:notes::jsonb,NOW())",[strParam("id",g.id),uuidParam("u",uuid),strParam("name",g.name||""),strParam("type",g.type||"other"),strParam("dest",g.destination),dateParam("dep",g.dep),dateParam("ret",g.ret),strParam("members",JSON.stringify(g.members||[])),strParam("flights",JSON.stringify(g.flights||[])),strParam("hotel",g.hotel?JSON.stringify(g.hotel):null),strParam("notes",JSON.stringify(g.notes||[]))]);
      }
      break;
    }
    default:
      throw {status:400,message:"Unknown module: "+module};
  }
}
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const sesClient = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
async function sendInviteEmail(toEmail, inviterName, message, inviteId) {
  const acceptUrl = "https://www.uniprofile.net/#invite=" + inviteId;
  const bodyHtml = [
    '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F6F3">',
    '<div style="background:#fff;border:1px solid #E5E4E0;border-radius:12px;padding:32px">',
    '<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#111;margin-bottom:4px">UniProfile</div>',
    '<div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px">Travel Identity Platform</div>',
    '<p style="font-size:15px;color:#111827;margin:0 0 12px"><strong>' + inviterName + '</strong> wants to link UniProfiles with you.</p>',
    message ? '<p style="font-size:13px;color:#374151;background:#F9FAFB;border-left:2px solid #E5E4E0;padding:12px 16px;border-radius:4px;margin:0 0 20px"><em>&ldquo;' + message + '&rdquo;</em></p>' : '',
    '<p style="font-size:13px;color:#6B7280;margin:0 0 24px">Linking lets you share trip details, boarding passes, insurance and tour info — with full control over exactly what each person sees.</p>',
    '<a href="' + acceptUrl + '" style="display:inline-block;background:#B45309;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">Accept Link Request</a>',
    '<p style="font-size:11px;color:#9CA3AF;margin:24px 0 0">If you don\'t have a UniProfile yet, you\'ll be guided to create one when you click the link above.</p>',
    '</div></div>'
  ].join("");
  const bodyText = inviterName + " wants to link UniProfiles with you on UniProfile.\n\n" +
    (message ? '"' + message + '"\n\n' : '') +
    "Accept the request here: " + acceptUrl + "\n\n" +
    "UniProfile — Travel Identity Platform";
  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: "invites@uniprofile.net",
    Destination: { ToAddresses: [toEmail] },
    Content: {
      Simple: {
        Subject: { Data: inviterName + " invited you to link UniProfiles", Charset: "UTF-8" },
        Body: {
          Html: { Data: bodyHtml, Charset: "UTF-8" },
          Text: { Data: bodyText, Charset: "UTF-8" },
        },
      },
    },
  }));
}
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const smClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });
let timaticToken = null;
let timaticTokenExpiry = null;
async function getTimaticToken() {
  if(timaticToken&&timaticTokenExpiry&&new Date()<timaticTokenExpiry)return timaticToken;
  const secret=await smClient.send(new GetSecretValueCommand({SecretId:"/uniprofile/timatic/credentials"}));
  const creds=JSON.parse(secret.SecretString);
  const params=new URLSearchParams();
  params.append("grant_type","client_credentials");
  params.append("client_id",creds.client_id);
  params.append("client_secret",creds.client_secret);
  params.append("scope",creds.scope||"qa-1/read");
  const response=await fetch(creds.token_url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params.toString()});
  const data=await response.json();
  if(!data.access_token)throw new Error("Failed to get Timatic token: "+JSON.stringify(data));
  timaticToken=data.access_token;
  timaticTokenExpiry=new Date(Date.now()+(data.expires_in-60)*1000);
  return timaticToken;
}
async function callTimaticAPI(nationality,passportCountry,destination,transitCountries,travelDate,passportExpiry,dob,gender) {
  try {
    const secret=await smClient.send(new GetSecretValueCommand({SecretId:"/uniprofile/timatic/credentials"}));
    const creds=JSON.parse(secret.SecretString);
    const apiKey=creds.api_key||creds.client_secret;
    console.log("API key length:", apiKey?apiKey.length:0, "first3:", apiKey?apiKey.slice(0,3):"none");
    const tDate=travelDate||new Date().toISOString().split("T")[0];
    const ISO3TO2={"USA":"US","GBR":"GB","IND":"IN","CAN":"CA","AUS":"AU","FRA":"FR","DEU":"DE","ITA":"IT","ESP":"ES","JPN":"JP","CHN":"CN","BRA":"BR","MEX":"MX","RUS":"RU","ZAF":"ZA","NGA":"NG","KEN":"KE","ARE":"AE","SAU":"SA","SGP":"SG","MYS":"MY","THA":"TH","PHL":"PH","IDN":"ID","NLD":"NL","BEL":"BE","CHE":"CH","AUT":"AT","SWE":"SE","NOR":"NO","DNK":"DK","FIN":"FI","IRL":"IE","PRT":"PT","GRC":"GR","POL":"PL","NZL":"NZ","ARG":"AR","CHL":"CL","COL":"CO","PER":"PE","TUR":"TR","IRN":"IR","IRQ":"IQ","EGY":"EG","MAR":"MA","TUN":"TN","DZA":"DZ","UKR":"UA","KAZ":"KZ","KOR":"KR","TWN":"TW","HKG":"HK","VNM":"VN","PAK":"PK","BGD":"BD","NPL":"NP","LKA":"LK","JOR":"JO","ISR":"IL","LBN":"LB","QAT":"QA","KWT":"KW","BHR":"BH","OMN":"OM","SYR":"SY"};
    function toISO2(c){return c?(ISO3TO2[c]||c.slice(0,2)):"US";}
    const nat2=toISO2(nationality);
    const pc2=toISO2(passportCountry||nationality);
    const payload={
      channel:"WEB",
      passengerId:"UP-"+Date.now(),
      transactionId:"TXN-"+Date.now(),
      language:"EN",
      passengerDetails:{
        nationality:nat2,
        residentCountryCode:nat2,
        birthDate:dob||"",
        birthCountry:nat2,
        gender:gender||"M",
        countriesVisited:{countries:[],visitedBeforeDays:0}
      },
      documentDetails:[{
        documentClass:"PASSPORT",
        documentCode:"P",
        nationality:nat2,
        documentIssueCountry:pc2,
        documentExpiryDate:passportExpiry||"",
        documentIssueDate:"",
        documentFeature:"",
        documentLanguage:"EN",
        documentMRZType:"TD",
        documentModel:"",
        documentRecord:"",
        documentSeries:"",
        applicationDate:tDate
      }],
      itineraryDetails:{
        segments:[{
          departure:{dateTime:tDate+"T00:00:00",point:"IAD",type:"AIRPORT"},
          arrival:{dateTime:tDate+"T23:00:00",point:destination||"HND",type:"AIRPORT"},
          operatingCarrier:"UA",
          processingEntity:destination||"HND",
          purposeOfStay:"TOURISM",
          returnOnwardTicket:"YES",
          luggageCollected:false,
          durationOfStay:{duration:7,timeUnit:"DAYS"}
        }]
      },
      extensions:[]
    };
    const response=await fetch("https://timatic-autocheck-rest-api.p-eu.rapidapi.com/query-interface-service/api/v1/documentRequest",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-RapidAPI-Key":apiKey,
        "X-RapidAPI-Host":"timatic-autocheck-rest-api.iata.rapidapi.com"
      },
      body:JSON.stringify(payload)
    });
    const responseText=await response.text();
    console.log("Timatic response status:",response.status);
    console.log("Timatic response:",responseText.slice(0,500));
    if(!response.ok){console.error("Timatic API error:",response.status,responseText);return null;}
    return JSON.parse(responseText);
  } catch(e){console.error("Timatic call failed:",e.message);return null;}
}
function parseTimaticResponse(timaticData,daysValid,nationality,destination) {
  if(!timaticData)return null;
  const visa=timaticData.visa||timaticData.Visa||{};
  const passport=timaticData.passport||timaticData.Passport||{};
  const health=timaticData.health||timaticData.Health||{};
  const visaRequired=visa.required!==false&&visa.Required!==false;
  const visaStatus=!visaRequired?"NOT_REQUIRED":"VISA_REQUIRED";
  const passportStatus=daysValid===null?"UNKNOWN":daysValid<0?"EXPIRED":daysValid<90?"WARNING":"OK";
  const overall=!visaRequired&&passportStatus==="OK"?"GREEN":passportStatus==="EXPIRED"?"RED":"AMBER";
  return {overall,
    visa:{status:visaStatus,required:visaRequired,note:visa.text||visa.Text||(visaRequired?"Visa required for travel to "+destination:"No visa required for "+nationality+" passport holders.")},
    passport:{status:passportStatus,days_valid:daysValid,note:passport.text||passport.Text||(passportStatus==="OK"?"Passport valid — "+daysValid+" days remaining.":"Check passport validity.")},
    eta:timaticData.eta?[{type:"ETA",status:"CHECK",note:timaticData.eta.text||""}]:[],
    transit:[],
    health:health.text?[{type:"HEALTH",status:"CHECK",note:health.text}]:[{type:"ROUTINE",status:"RECOMMENDED",note:"No mandatory vaccinations required."}],
    pre_registration:(destination==="JPN"||destination==="HND"||destination==="NRT")?[{name:"Visit Japan Web",url:"https://vjw-lp.digital.go.jp",status:"RECOMMENDED",note:"Pre-register for faster immigration and customs processing."}]:[],
    nationality,destination,checked_at:new Date().toISOString(),source:"TIMATIC_LIVE",timatic_ready:true};
}
function runTimaticRules(nationality,destination,transits,daysValid,esta,travelDate){
  const VISA_FREE={
    USA:["JPN","GBR","FRA","DEU","ITA","ESP","PRT","NLD","BEL","CHE","AUT","GRC","SWE","NOR","DNK","FIN","IRL","LUX","ISL","AUS","NZL","CAN","SGP","KOR","TWN","HKG","MAC","BRN","CHL","MEX","ISR","ARE","QAT","BHR","KWT","OMN","MYS","THA","PHL","IDN","ZAF","MAR","TUN","JOR","BRA","ARG","URY","PRY","COL","PER","CRI","PAN","GTM"],
    GBR:["JPN","FRA","DEU","ITA","ESP","USA","CAN","AUS","NZL","SGP","ARE","ZAF"],
    IND:["JPN","FRA","DEU","GBR","USA","AUS","CAN","SGP"],
    CAN:["JPN","GBR","FRA","DEU","ITA","ESP","AUS","NZL","USA","MEX","BRA"],
  };
  const PASSPORT_RULES={
    JPN:{validity_days:0,note:"Passport must be valid for duration of stay only"},
    GBR:{validity_days:90,note:"Passport must be valid for 6 months beyond stay for some nationals"},
    USA:{validity_days:0,note:"No minimum validity beyond stay"},
    AUS:{validity_days:180,note:"Passport must be valid for 6 months"},
    IND:{validity_days:180,note:"Passport must be valid for 6 months"},
    ARE:{validity_days:180,note:"Passport must be valid for 6 months"},
    CHN:{validity_days:180,note:"Passport must be valid for 6 months"},
    THA:{validity_days:180,note:"Passport must be valid for 6 months beyond stay"},
  };
  const ESTA_REQUIRED=["USA"];
  const ETA_REQUIRED={CAN:"ETA",AUS:"ETA",NZL:"NZeTA",GBR:"UK_ETA",KOR:"K_ETA"};
  const dest = destination;
  const nat = nationality;
  // Visa check
  var visaStatus="UNKNOWN", visaNote="", visaRequired=true;
  if(VISA_FREE[nat]&&VISA_FREE[nat].indexOf(dest)>-1){
    visaStatus="NOT_REQUIRED"; visaRequired=false;
    visaNote="Visa not required for "+nat+" passport holders. Visa-free stay typically up to 90 days.";
  } else if(nat===dest||dest==="USA"&&nat==="USA"){
    visaStatus="NOT_REQUIRED"; visaRequired=false; visaNote="No visa required — domestic or own country.";
  } else {
    visaStatus="CHECK_REQUIRED";
    visaNote="Please verify visa requirements for "+nat+" nationals traveling to "+dest+". Consult embassy or Timatic.";
  }
  // Passport check
  var passportStatus="OK", passportNote="";
  var rule = PASSPORT_RULES[dest]||{validity_days:0,note:"Standard passport validity applies"};
  if(daysValid===null){
    passportStatus="UNKNOWN"; passportNote="No passport on file. Add your passport to get a validity check.";
  } else if(daysValid<0){
    passportStatus="EXPIRED"; passportNote="Your passport has expired. Renew immediately before travel.";
  } else if(daysValid<rule.validity_days){
    passportStatus="WARNING"; passportNote="Passport may be insufficient for "+dest+". Required: "+rule.validity_days+" days validity. You have: "+daysValid+" days. "+rule.note;
  } else if(daysValid<90){
    passportStatus="WARNING"; passportNote="Passport expires in "+daysValid+" days. Renew before booking further travel.";
  } else {
    passportStatus="OK"; passportNote="Passport valid — "+daysValid+" days remaining. "+rule.note;
  }
  // ETA/ESTA check
  var etaChecks=[];
  if(ESTA_REQUIRED.indexOf(dest)>-1&&nat!=="USA"){
    var estaOk=esta&&esta.esta_status==="APPROVED";
    etaChecks.push({type:"ESTA",destination:dest,status:estaOk?"OK":"REQUIRED",note:estaOk?"ESTA approved and on file.":"ESTA required for entry to USA. Apply at esta.cbp.dhs.gov before travel."});
  }
  if(ETA_REQUIRED[dest]&&nat==="USA"){
    etaChecks.push({type:ETA_REQUIRED[dest],destination:dest,status:"CHECK",note:"Electronic travel authorization may be required. Check latest requirements for "+dest+"."});
  }
  // Transit checks
  var transitChecks=[];
  transits.forEach(function(t){
    if(t==="USA"||t==="ORD"||t==="JFK"||t==="LAX"||t==="ORD"||t==="ATL"||t==="DFW"){
      if(nat==="USA") transitChecks.push({iata:t,status:"OK",note:"US citizen — no transit visa required."});
      else transitChecks.push({iata:t,status:"CHECK",note:"Non-US nationals transiting USA may need a transit visa or ESTA."});
    } else if(t==="HND"||t==="NRT"||t==="KIX"){
      transitChecks.push({iata:t,status:"OK",note:"Japan — airside transit generally does not require a visa for most nationalities."});
    }
  });
  // Health requirements
  var healthChecks=[];
  var YELLOW_FEVER_RISK=["BRA","COL","PER","ECU","BOL","VEN","GUY","SUR","TGO","CMR","NGA","GHA","BEN","ETH","KEN","COD","AGO","MOZ","GAB","UGA","RWA","BDI","TZA","MDG"];
  if(YELLOW_FEVER_RISK.indexOf(dest)>-1){
    healthChecks.push({type:"YELLOW_FEVER",status:"REQUIRED",note:"Yellow fever vaccination certificate required for entry to "+dest+"."});
  } else {
    healthChecks.push({type:"ROUTINE",status:"RECOMMENDED",note:"No mandatory vaccinations required. Routine vaccinations recommended."});
  }
  // Pre-registration
  var preRegistration=[];
  if(dest==="JPN"||dest==="HND"||dest==="NRT"||dest==="KIX"||dest==="ITM"){
    preRegistration.push({name:"Visit Japan Web",url:"https://vjw-lp.digital.go.jp",status:"RECOMMENDED",note:"Pre-register for faster immigration and customs processing. Generates QR code for arrival."});
  }
  if(dest==="AUS"||dest==="SYD"||dest==="MEL"||dest==="BNE"){
    preRegistration.push({name:"Australia ETA",url:"https://immi.homeaffairs.gov.au",status:"REQUIRED",note:"ETA (subclass 601) required for US citizens traveling to Australia."});
  }
  var overall = visaStatus==="NOT_REQUIRED"&&passportStatus==="OK"?"GREEN":passportStatus==="EXPIRED"||visaStatus==="VISA_REQUIRED"?"RED":"AMBER";
  return {overall,visa:{status:visaStatus,required:visaRequired,note:visaNote},passport:{status:passportStatus,days_valid:daysValid,note:passportNote},eta:etaChecks,transit:transitChecks,health:healthChecks,pre_registration:preRegistration,nationality,destination,checked_at:new Date().toISOString(),source:"RULES_ENGINE",timatic_ready:false};
}
async function buildFamilyProfile(myUuid) {
  const p = [uuidParam("u", myUuid)];
  // Get accepted links where I am either requester or target
  const links = await sql(
    "SELECT fl.id, fl.requester_uuid, fl.target_uuid, fl.created_at, " +
    "CASE WHEN fl.requester_uuid=:u THEN t2.uuid ELSE t1.uuid END AS member_uuid, " +
    "CASE WHEN fl.requester_uuid=:u THEN t2.email ELSE t1.email END AS member_email, " +
    "CASE WHEN fl.requester_uuid=:u THEN i2.legal_first ELSE i1.legal_first END AS member_first, " +
    "CASE WHEN fl.requester_uuid=:u THEN i2.legal_last ELSE i1.legal_last END AS member_last " +
    "FROM family_links fl " +
    "JOIN travelers t1 ON t1.uuid=fl.requester_uuid " +
    "JOIN travelers t2 ON t2.uuid=fl.target_uuid " +
    "LEFT JOIN traveler_identity i1 ON i1.traveler_uuid=fl.requester_uuid " +
    "LEFT JOIN traveler_identity i2 ON i2.traveler_uuid=fl.target_uuid " +
    "WHERE (fl.requester_uuid=:u OR fl.target_uuid=:u) AND fl.status='accepted'", p);
  // Build linked members with consent
  const linked = await Promise.all(links.map(async (lk) => {
    const memberUuid = lk.member_uuid;
    const [myConsent, theirConsent, sharedTrips, sharedInsurance, sharedTours] = await Promise.all([
      sql("SELECT share_trips,share_pnr,share_insurance,share_tours FROM family_consent WHERE owner_uuid=:o AND member_uuid=:m",
        [uuidParam("o", myUuid), uuidParam("m", memberUuid)]),
      sql("SELECT share_trips,share_pnr,share_insurance,share_tours FROM family_consent WHERE owner_uuid=:o AND member_uuid=:m",
        [uuidParam("o", memberUuid), uuidParam("m", myUuid)]),
      sql("SELECT t.id,t.trip_name,t.trip_locator,t.departure_date,t.return_date,t.origin_iata,t.destination_iata,t.status FROM trips t " +
        "JOIN family_consent fc ON fc.owner_uuid=:m AND fc.member_uuid=:u AND fc.share_trips=TRUE " +
        "WHERE t.traveler_uuid=:m ORDER BY t.departure_date DESC LIMIT 10",
        [uuidParam("m", memberUuid), uuidParam("u", myUuid)]),
      sql("SELECT ti.id,ti.provider,ti.policy_number,ti.coverage_summary,ti.valid_until,ti.emergency_phone FROM traveler_insurance ti " +
        "JOIN family_consent fc ON fc.owner_uuid=:m AND fc.member_uuid=:u AND fc.share_insurance=TRUE " +
        "WHERE ti.traveler_uuid=:m AND (ti.valid_until IS NULL OR ti.valid_until >= NOW()::date)",
        [uuidParam("m", memberUuid), uuidParam("u", myUuid)]),
      sql("SELECT tt.id,tt.operator,tt.tour_name,tt.tour_date,tt.duration,tt.reference,tt.meeting_point FROM traveler_tours tt " +
        "JOIN family_consent fc ON fc.owner_uuid=:m AND fc.member_uuid=:u AND fc.share_tours=TRUE " +
        "WHERE tt.traveler_uuid=:m ORDER BY tt.tour_date DESC LIMIT 10",
        [uuidParam("m", memberUuid), uuidParam("u", myUuid)]),
    ]);
    const mc = myConsent[0] || {share_trips:false,share_pnr:false,share_insurance:false,share_tours:false};
    const tc = theirConsent[0] || {share_trips:false,share_pnr:false,share_insurance:false,share_tours:false};
    const name = [lk.member_first, lk.member_last].filter(Boolean).join(" ") || lk.member_email;
    // Attach segments to shared trips (only if pnr consent)
    const tripsWithSegs = await Promise.all(sharedTrips.map(async (t) => {
      if (!tc.share_pnr) return Object.assign({}, t, {segments:[]});
      const segs = await sql("SELECT segment_order,carrier,flight_number,origin_iata,destination_iata,departure_datetime,arrival_datetime,cabin_class,seat_number,duration_minutes FROM trip_segments WHERE trip_id=:tid ORDER BY segment_order",
        [strParam("tid", t.id)]);
      return Object.assign({}, t, {segments: segs});
    }));
    return {
      id: lk.id,
      uuid: memberUuid,
      name,
      email: lk.member_email,
      linked_since: lk.created_at,
      my_consent: {trips: mc.share_trips, pnr: mc.share_pnr, insurance: mc.share_insurance, tours: mc.share_tours},
      their_consent: {trips: tc.share_trips, pnr: tc.share_pnr, insurance: tc.share_insurance, tours: tc.share_tours},
      shared_trips: tripsWithSegs,
      shared_insurance: sharedInsurance.map(i => ({id:i.id,provider:i.provider,policy_number:i.policy_number,coverage:i.coverage_summary,valid_until:i.valid_until,emergency_phone:i.emergency_phone})),
      shared_tours: sharedTours.map(t => ({id:t.id,operator:t.operator,name:t.tour_name,date:t.tour_date,duration:t.duration,reference:t.reference,meeting_point:t.meeting_point})),
    };
  }));
  // Pending received invites
  const received = await sql(
    "SELECT fi.id,fi.requester_uuid,fi.message,fi.created_at,t.email AS from_email, " +
    "i.legal_first,i.legal_last FROM family_invites fi " +
    "JOIN travelers t ON t.uuid=fi.requester_uuid " +
    "LEFT JOIN traveler_identity i ON i.traveler_uuid=fi.requester_uuid " +
    "WHERE fi.target_uuid=:u AND fi.status='pending'", p);
  // Pending sent invites
  const sent = await sql(
    "SELECT fi.id,fi.target_email,fi.target_uuid,fi.created_at,t.email AS to_email, " +
    "i.legal_first,i.legal_last FROM family_invites fi " +
    "LEFT JOIN travelers t ON t.uuid=fi.target_uuid " +
    "LEFT JOIN traveler_identity i ON i.traveler_uuid=fi.target_uuid " +
    "WHERE fi.requester_uuid=:u AND fi.status='pending'", p);
  const [myInsurance, myTours] = await Promise.all([
    sql("SELECT id,provider,policy_number,coverage_summary,valid_from,valid_until,emergency_phone FROM traveler_insurance WHERE traveler_uuid=:u ORDER BY created_at DESC", p),
    sql("SELECT id,operator,tour_name,tour_date,duration,reference,meeting_point FROM traveler_tours WHERE traveler_uuid=:u ORDER BY tour_date DESC", p),
  ]);
  return {
    linked: linked,
    my_insurance: myInsurance,
    my_tours: myTours,
    received: received.map(r => ({
      id: r.id,
      from_uuid: r.requester_uuid,
      from_name: [r.legal_first, r.legal_last].filter(Boolean).join(" ") || r.from_email,
      from_email: r.from_email,
      message: r.message,
      sent_at: r.created_at,
    })),
    sent: sent.map(s => ({
      id: s.id,
      to_email: s.target_email || s.to_email,
      to_name: [s.legal_first, s.legal_last].filter(Boolean).join(" ") || s.to_email || s.target_email,
      sent_at: s.created_at,
    })),
  };
}
exports.handler=async function(event){
  const method=event.httpMethod,path=event.path||"";
  const _uuidRe=/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const uuid=(event.pathParameters&&event.pathParameters.uuid)||(_uuidRe.exec(path)||[])[1]||null;
  const body=event.body?(()=>{try{return JSON.parse(event.body);}catch(e){return{};}})():{};
  try{
    if(method==="OPTIONS")return{statusCode:200,headers:cors(go(event)),body:""};
    if(method==="GET"&&path==="/health")return ok({status:"ok",stage:process.env.STAGE,ts:new Date().toISOString()},event);
    if(method==="GET"&&path==="/api/v1/me"){
      const token=await verifyToken(event);
      const travelerUuid=await getOrCreateTraveler(token.sub,token.email);
      if(!travelerUuid)return err("Traveler not found",event,404);
      return ok(await buildProfile(travelerUuid),event);
    }
    if(method==="GET"&&path.match(/\/profile\/[^/]+$/)&&path.indexOf("/bleisure")===-1){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      return ok(await buildProfile(uuid),event);
    }
    if(method==="PUT"&&path.match(/\/profile\/[^/]+$/)&&path.indexOf("/bleisure")===-1){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      if(!body.module||!body.data)return err("Missing module or data",event,400);
      await updateModule(uuid,body.module,body.data);
      return ok({success:true,module:body.module,profile:await buildProfile(uuid)},event);
    }
    if(method==="GET"&&path.indexOf("/bleisure")!==-1){
      const rows=await sql("SELECT active_context,last_switched_at FROM bleisure_context WHERE traveler_uuid=:u",[uuidParam("u",uuid)]);
      return ok(rows[0]||{active_context:"PERSONAL"},event);
    }
    if(method==="POST"&&path.indexOf("/bleisure")!==-1){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const context=body.context;
      if(["PERSONAL","CORPORATE","BLEISURE"].indexOf(context)===-1)return err("Invalid context",event,400);
      await sql("INSERT INTO bleisure_context (traveler_uuid,active_context,last_switched_at,switched_by) VALUES (:u,:ctx,NOW(),'USER') ON CONFLICT (traveler_uuid) DO UPDATE SET active_context=:ctx,last_switched_at=NOW(),switched_by='USER'",[uuidParam("u",uuid),strParam("ctx",context)]);
      return ok({success:true,active_context:context},event);
    }
    if(method==="POST"&&path.indexOf("/transactions/")!==-1){
      const key=event.headers&&event.headers["x-uniprofile-key"];
      if(!key)return err("Platform authentication required",event,401);
      const t=body;
      const tripRows=await sql("INSERT INTO trips (traveler_uuid,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,source_platform,total_fare,currency) VALUES (:u,:name,:pnr,:dep,:ret,:orig,:dest,:ctx,:src,:fare,:cur) RETURNING id",[uuidParam("u",uuid),strParam("name",t.trip_name||(t.origin_iata+"-"+t.destination_iata)),strParam("pnr",t.pnr),dateParam("dep",t.departure_date),dateParam("ret",t.return_date),strParam("orig",t.origin_iata),strParam("dest",t.destination_iata),strParam("ctx",t.trip_context||"PERSONAL"),strParam("src","platform"),numParam("fare",t.total_fare),strParam("cur",t.currency||"USD")]);
      const tripId=tripRows[0]&&tripRows[0].id;
      if(tripId&&t.carrier)await sql("INSERT INTO trip_segments (trip_id,segment_type,segment_order,carrier,flight_number,origin_iata,destination_iata,cabin_class,booking_ref) VALUES (:tid,'FLIGHT',1,:car,:flt,:orig,:dest,:cab,:ref)",[strParam("tid",tripId),strParam("car",t.carrier),strParam("flt",t.flight_number),strParam("orig",t.origin_iata),strParam("dest",t.destination_iata),strParam("cab",t.cabin_class),strParam("ref",t.pnr)]);
      return ok({success:true,trip_id:tripId},event,201);
    }
    if(method==="GET"&&path.indexOf("/alerts/")!==-1){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const alerts=await sql("SELECT doc_type,expiry_date,days_remaining,alert_level FROM expiring_documents WHERE traveler_uuid=:u AND alert_level IN ('EXPIRED','CRITICAL','WARNING') ORDER BY days_remaining ASC",[uuidParam("u",uuid)]);
      return ok({alerts},event);
    }
    if(method==="POST"&&(path.indexOf("/doccheck/")!==-1||path.endsWith("/doccheck"))){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid) return err("Access denied",event,403);
      const {destination_iata,origin_iata,transit_iatas,travel_date,trip_id}=body;
      // Get traveler docs and identity
      const [identity,docs]=await Promise.all([
        sql("SELECT nationality,gender_code FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",uuid)]),
        sql("SELECT doc_type,issuing_country,nationality,expiry_date,esta_status FROM travel_documents WHERE traveler_uuid=:u AND is_primary=TRUE",[uuidParam("u",uuid)])
      ]);
      const nat = identity[0]&&identity[0].nationality||"USA";
      const passport = docs.find(d=>d.doc_type==="PASSPORT");
      const esta = docs.find(d=>d.doc_type==="ESTA");
      const passportExpiry = passport&&passport.expiry_date?new Date(passport.expiry_date):null;
      const travelDate = travel_date?new Date(travel_date):new Date();
      const daysValid = passportExpiry?Math.floor((passportExpiry-travelDate)/86400000):null;
      // Rules engine
      // Try live Timatic first, fall back to rules engine
      let result = null;
      try {
        const timaticData = await callTimaticAPI(nat, passport&&passport.issuing_country, destination_iata, transit_iatas||[], travel_date);
        result = parseTimaticResponse(timaticData, daysValid, nat, destination_iata);
      } catch(e) {
        console.log("Timatic live failed, using rules engine:", e.message);
      }
      if(!result) result = runTimaticRules(nat,destination_iata,transit_iatas||[],daysValid,esta,travelDate);
      return ok({success:true,result},event);
    }
    // ── Family Profile Routes ──────────────────────────────────────────────
    // GET /api/v1/family/{uuid}
    if(method==="GET"&&path.startsWith("/api/v1/family/")&&!path.includes("/invite")&&!path.includes("/consent")&&!path.includes("/respond")&&path.split("/").filter(Boolean).length===4){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      return ok(await buildFamilyProfile(myUuid),event);
    }
    // POST /api/v1/family/{uuid}/invite
    if(method==="POST"&&path.startsWith("/api/v1/family/")&&path.endsWith("/invite")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {email:inviteEmail,message:inviteMsg}=body;
      if(!inviteEmail)return err("Email required",event,400);
      if(inviteEmail.toLowerCase()===token.email.toLowerCase())return err("Cannot invite yourself",event,400);
      // Check if target already has an account
      const targetRows=await sql("SELECT uuid FROM travelers WHERE email=:e",[strParam("e",inviteEmail)]);
      const targetUuid=targetRows[0]&&targetRows[0].uuid||null;
      // Check for existing pending/accepted link
      if(targetUuid){
        const existing=await sql(
          "SELECT id FROM family_invites WHERE requester_uuid=:r AND target_uuid=:t AND status='pending' " +
          "UNION SELECT id FROM family_links WHERE (requester_uuid=:r AND target_uuid=:t) OR (requester_uuid=:t AND target_uuid=:r)",
          [uuidParam("r",myUuid),uuidParam("t",targetUuid)]);
        if(existing.length)return err("Invite or link already exists",event,409);
      }
      const invite=await sql(
        "INSERT INTO family_invites (requester_uuid,target_uuid,target_email,message,status) VALUES (:r,:t,:e,:msg,'pending') RETURNING id,created_at",
        [uuidParam("r",myUuid),targetUuid?uuidParam("t",targetUuid):{name:"t",value:{isNull:true}},strParam("e",inviteEmail),strParam("msg",inviteMsg||null)]);
      // Get inviter name for email
      const inviterRows=await sql("SELECT legal_first,legal_last,email FROM travelers t LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE t.uuid=:u",[uuidParam("u",myUuid)]);
      const inviter=inviterRows[0]||{};
      const inviterName=[inviter.legal_first,inviter.legal_last].filter(Boolean).join(" ")||inviter.email||"A UniProfile member";
      sendInviteEmail(inviteEmail,inviterName,inviteMsg||"",invite[0].id).catch(e=>console.error("SES send failed:",e.message));
      return ok({success:true,invite_id:invite[0].id,sent_at:invite[0].created_at},event,201);
    }
    // POST /api/v1/family/{uuid}/respond
    if(method==="POST"&&path.startsWith("/api/v1/family/")&&path.endsWith("/respond")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {invite_id,action}=body;
      if(!invite_id||!["accept","decline"].includes(action))return err("invite_id and action (accept/decline) required",event,400);
      const inviteRows=await sql(
        "SELECT id,requester_uuid FROM family_invites WHERE id=:id AND target_uuid=:u AND status='pending'",
        [uuidParam("id",invite_id),uuidParam("u",myUuid)]);
      if(!inviteRows.length)return err("Invite not found",event,404);
      const invite=inviteRows[0];
      await sql("UPDATE family_invites SET status=:s,responded_at=NOW() WHERE id=:id",
        [strParam("s",action==="accept"?"accepted":"declined"),uuidParam("id",invite_id)]);
      if(action==="accept"){
        await sql("INSERT INTO family_links (requester_uuid,target_uuid,status) VALUES (:r,:t,'accepted') ON CONFLICT DO NOTHING",
          [uuidParam("r",invite.requester_uuid),uuidParam("t",myUuid)]);
        // Seed default consent rows (share nothing by default)
        await sql("INSERT INTO family_consent (owner_uuid,member_uuid,share_trips,share_pnr,share_insurance,share_tours) VALUES (:o,:m,FALSE,FALSE,FALSE,FALSE) ON CONFLICT DO NOTHING",
          [uuidParam("o",myUuid),uuidParam("m",invite.requester_uuid)]);
        await sql("INSERT INTO family_consent (owner_uuid,member_uuid,share_trips,share_pnr,share_insurance,share_tours) VALUES (:o,:m,FALSE,FALSE,FALSE,FALSE) ON CONFLICT DO NOTHING",
          [uuidParam("o",invite.requester_uuid),uuidParam("m",myUuid)]);
      }
      return ok({success:true,action},event);
    }
    // PUT /api/v1/family/{uuid}/consent
    if(method==="PUT"&&path.startsWith("/api/v1/family/")&&path.endsWith("/consent")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {member_id,type,value}=body;
      if(!member_id||!type)return err("member_id and type required",event,400);
      const VALID_TYPES={trips:"share_trips",pnr:"share_pnr",insurance:"share_insurance",tours:"share_tours"};
      const col=VALID_TYPES[type];
      if(!col)return err("Invalid consent type. Must be one of: trips, pnr, insurance, tours",event,400);
      // Verify link exists
      const linkRows=await sql(
        "SELECT id FROM family_links WHERE ((requester_uuid=:u AND target_uuid=:m) OR (requester_uuid=:m AND target_uuid=:u)) AND status='accepted'",
        [uuidParam("u",myUuid),uuidParam("m",member_id)]);
      if(!linkRows.length)return err("No active family link with this member",event,404);
      await sql(
        "INSERT INTO family_consent (owner_uuid,member_uuid,share_trips,share_pnr,share_insurance,share_tours) VALUES (:o,:m,FALSE,FALSE,FALSE,FALSE) ON CONFLICT (owner_uuid,member_uuid) DO UPDATE SET "+col+"=:v,updated_at=NOW()",
        [uuidParam("o",myUuid),uuidParam("m",member_id),boolParam("v",value)]);
      return ok({success:true,type,value:Boolean(value)},event);
    }
    // DELETE /api/v1/family/{uuid}/invite/{inviteId}
    if(method==="DELETE"&&path.startsWith("/api/v1/family/")&&path.includes("/invite/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");
      const inviteId=parts[parts.length-1];
      await sql("UPDATE family_invites SET status='cancelled' WHERE id=:id AND requester_uuid=:u AND status='pending'",
        [uuidParam("id",inviteId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // DELETE /api/v1/family/{uuid}/{memberId}  — unlink
    if(method==="DELETE"&&path.startsWith("/api/v1/family/")&&!path.includes("/invite")&&path.split("/").filter(Boolean).length===5){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");
      const memberId=parts[parts.length-1];
      await sql(
        "UPDATE family_links SET status='unlinked' WHERE ((requester_uuid=:u AND target_uuid=:m) OR (requester_uuid=:m AND target_uuid=:u)) AND status='accepted'",
        [uuidParam("u",myUuid),uuidParam("m",memberId)]);
      await sql("DELETE FROM family_consent WHERE (owner_uuid=:u AND member_uuid=:m) OR (owner_uuid=:m AND member_uuid=:u)",
        [uuidParam("u",myUuid),uuidParam("m",memberId)]);
      return ok({success:true},event);
    }
    // ── Cruise Profile Routes ──────────────────────────────────────────────────
    // GET /api/v1/cruise/{uuid}
    if(method==="GET"&&path.startsWith("/api/v1/cruise/")&&path.split("/").filter(Boolean).length===4){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const p=[uuidParam("u",myUuid)];
      const [bookings,prefs,excursions]=await Promise.all([
        sql("SELECT * FROM cruise_bookings WHERE traveler_uuid=:u ORDER BY sail_date DESC",p),
        sql("SELECT * FROM cruise_preferences WHERE traveler_uuid=:u",p),
        sql("SELECT * FROM cruise_excursions WHERE traveler_uuid=:u ORDER BY excursion_date ASC",p),
      ]);
      const now=new Date();
      const bookingsEnriched=bookings.map(b=>{
        let poc=b.ports_of_call;
        try{poc=typeof poc==="string"?JSON.parse(poc):(poc||[]);}catch(e){poc=[];}
        const sail=b.sail_date?new Date(b.sail_date):null;
        const ret=b.return_date?new Date(b.return_date):null;
        const daysUntil=sail?Math.floor((sail-now)/86400000):null;
        const status=!sail?"upcoming":daysUntil>0?"upcoming":ret&&now<=ret?"in-progress":"completed";
        return Object.assign({},b,{ports_of_call:poc,days_until:daysUntil,status});
      });
      return ok({bookings:bookingsEnriched,preferences:prefs[0]||null,excursions},event);
    }
    // POST /api/v1/cruise/{uuid}/booking
    if(method==="POST"&&path.startsWith("/api/v1/cruise/")&&path.endsWith("/booking")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const b=body;
      if(!b.cruise_line)return err("cruise_line required",event,400);
      const rows=await sql(
        "INSERT INTO cruise_bookings (traveler_uuid,cruise_line,ship_name,voyage_number,booking_reference,sail_date,return_date,nights,embarkation_port,disembarkation_port,cabin_number,cabin_category,deck,dining_preference,muster_station,ports_of_call,total_fare,currency,notes) VALUES (:u,:cl,:sn,:vn,:br,:sd,:rd,:ni,:ep,:dp,:cn,:cc,:dk,:din,:ms,:poc::jsonb,:fare,:cur,:notes) RETURNING id",
        [uuidParam("u",myUuid),strParam("cl",b.cruise_line),strParam("sn",b.ship_name),strParam("vn",b.voyage_number),strParam("br",b.booking_reference),dateParam("sd",b.sail_date),dateParam("rd",b.return_date),numParam("ni",b.nights),strParam("ep",b.embarkation_port),strParam("dp",b.disembarkation_port),strParam("cn",b.cabin_number),strParam("cc",b.cabin_category),strParam("dk",b.deck),strParam("din",b.dining_preference),strParam("ms",b.muster_station),strParam("poc",JSON.stringify(b.ports_of_call||[])),numParam("fare",b.total_fare),strParam("cur",b.currency||"USD"),strParam("notes",b.notes)]);
      return ok({success:true,id:rows[0].id},event,201);
    }
    // PUT /api/v1/cruise/{uuid}/booking/{id}
    if(method==="PUT"&&path.startsWith("/api/v1/cruise/")&&path.includes("/booking/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");const bookingId=parts[parts.length-1];
      const b=body;
      await sql(
        "UPDATE cruise_bookings SET cruise_line=:cl,ship_name=:sn,voyage_number=:vn,booking_reference=:br,sail_date=:sd,return_date=:rd,nights=:ni,embarkation_port=:ep,disembarkation_port=:dp,cabin_number=:cn,cabin_category=:cc,deck=:dk,dining_preference=:din,muster_station=:ms,ports_of_call=:poc::jsonb,total_fare=:fare,currency=:cur,notes=:notes,updated_at=NOW() WHERE id=:id AND traveler_uuid=:u",
        [strParam("cl",b.cruise_line),strParam("sn",b.ship_name),strParam("vn",b.voyage_number),strParam("br",b.booking_reference),dateParam("sd",b.sail_date),dateParam("rd",b.return_date),numParam("ni",b.nights),strParam("ep",b.embarkation_port),strParam("dp",b.disembarkation_port),strParam("cn",b.cabin_number),strParam("cc",b.cabin_category),strParam("dk",b.deck),strParam("din",b.dining_preference),strParam("ms",b.muster_station),strParam("poc",JSON.stringify(b.ports_of_call||[])),numParam("fare",b.total_fare),strParam("cur",b.currency||"USD"),strParam("notes",b.notes),uuidParam("id",bookingId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // DELETE /api/v1/cruise/{uuid}/booking/{id}
    if(method==="DELETE"&&path.startsWith("/api/v1/cruise/")&&path.includes("/booking/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");const bookingId=parts[parts.length-1];
      await sql("DELETE FROM cruise_bookings WHERE id=:id AND traveler_uuid=:u",[uuidParam("id",bookingId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // PUT /api/v1/cruise/{uuid}/preferences
    if(method==="PUT"&&path.startsWith("/api/v1/cruise/")&&path.endsWith("/preferences")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const pr=body;
      await sql(
        "INSERT INTO cruise_preferences (traveler_uuid,cabin_type,deck_preference,bed_config,dining_seating,dining_table_size,accessibility_needs,notes) VALUES (:u,:ct,:dp,:bc,:ds,:dts,:an,:notes) ON CONFLICT (traveler_uuid) DO UPDATE SET cabin_type=:ct,deck_preference=:dp,bed_config=:bc,dining_seating=:ds,dining_table_size=:dts,accessibility_needs=:an,notes=:notes,updated_at=NOW()",
        [uuidParam("u",myUuid),strParam("ct",pr.cabin_type),strParam("dp",pr.deck_preference),strParam("bc",pr.bed_config),strParam("ds",pr.dining_seating),strParam("dts",pr.dining_table_size),strParam("an",pr.accessibility_needs),strParam("notes",pr.notes)]);
      return ok({success:true},event);
    }
    // POST /api/v1/cruise/{uuid}/excursion
    if(method==="POST"&&path.startsWith("/api/v1/cruise/")&&path.endsWith("/excursion")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const ex=body;
      if(!ex.port||!ex.excursion_name)return err("port and excursion_name required",event,400);
      const rows=await sql(
        "INSERT INTO cruise_excursions (traveler_uuid,cruise_booking_id,port,excursion_name,operator,excursion_date,excursion_time,duration,booking_reference,meeting_point,price,currency) VALUES (:u,:bid,:port,:name,:op,:ed,:et,:dur,:ref,:mp,:price,:cur) RETURNING id",
        [uuidParam("u",myUuid),ex.cruise_booking_id?uuidParam("bid",ex.cruise_booking_id):{name:"bid",value:{isNull:true}},strParam("port",ex.port),strParam("name",ex.excursion_name),strParam("op",ex.operator),dateParam("ed",ex.excursion_date),strParam("et",ex.excursion_time),strParam("dur",ex.duration),strParam("ref",ex.booking_reference),strParam("mp",ex.meeting_point),numParam("price",ex.price),strParam("cur",ex.currency||"USD")]);
      return ok({success:true,id:rows[0].id},event,201);
    }
    // DELETE /api/v1/cruise/{uuid}/excursion/{id}
    if(method==="DELETE"&&path.startsWith("/api/v1/cruise/")&&path.includes("/excursion/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");const exId=parts[parts.length-1];
      await sql("DELETE FROM cruise_excursions WHERE id=:id AND traveler_uuid=:u",[uuidParam("id",exId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // POST /api/v1/insurance/{uuid}
    if(method==="POST"&&path.startsWith("/api/v1/insurance/")&&path.split("/").filter(Boolean).length===4){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {provider,policy_number,coverage_summary,valid_from,valid_until,emergency_phone}=body;
      if(!provider)return err("provider required",event,400);
      const rows=await sql("INSERT INTO traveler_insurance (traveler_uuid,provider,policy_number,coverage_summary,valid_from,valid_until,emergency_phone) VALUES (:u,:prov,:pol,:cov,:vf,:vu,:ep) RETURNING id",
        [uuidParam("u",myUuid),strParam("prov",provider),strParam("pol",policy_number),strParam("cov",coverage_summary),dateParam("vf",valid_from),dateParam("vu",valid_until),strParam("ep",emergency_phone)]);
      return ok({success:true,id:rows[0].id},event,201);
    }
    // DELETE /api/v1/insurance/{uuid}/{id}
    if(method==="DELETE"&&path.startsWith("/api/v1/insurance/")&&path.split("/").filter(Boolean).length===5){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");
      const insId=parts[parts.length-1];
      await sql("DELETE FROM traveler_insurance WHERE id=:id AND traveler_uuid=:u",[uuidParam("id",insId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // POST /api/v1/tours/{uuid}
    if(method==="POST"&&path.startsWith("/api/v1/tours/")&&path.split("/").filter(Boolean).length===4){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {operator,tour_name,tour_date,duration,reference,meeting_point}=body;
      if(!operator||!tour_name)return err("operator and tour_name required",event,400);
      const rows=await sql("INSERT INTO traveler_tours (traveler_uuid,operator,tour_name,tour_date,duration,reference,meeting_point) VALUES (:u,:op,:tn,:td,:dur,:ref,:mp) RETURNING id",
        [uuidParam("u",myUuid),strParam("op",operator),strParam("tn",tour_name),dateParam("td",tour_date),strParam("dur",duration),strParam("ref",reference),strParam("mp",meeting_point)]);
      return ok({success:true,id:rows[0].id},event,201);
    }
    // DELETE /api/v1/tours/{uuid}/{id}
    if(method==="DELETE"&&path.startsWith("/api/v1/tours/")&&path.split("/").filter(Boolean).length===5){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const parts=path.split("/");
      const tourId=parts[parts.length-1];
      await sql("DELETE FROM traveler_tours WHERE id=:id AND traveler_uuid=:u",[uuidParam("id",tourId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // POST /api/v1/groups/{grp_id}/note-alert  — notify members of a new note
    if(method==="POST"&&path.match(/\/api\/v1\/groups\/[^/]+\/note-alert$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");
      const grpId=parts[parts.length-2];
      const{text:noteText,author:authorName}=body;
      // Verify caller owns group and get member list
      const grpRows=await sql("SELECT name,destination,members FROM traveler_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",grpId),uuidParam("u",myUuid)]);
      if(!grpRows.length)return ok({success:true},event); // silently ignore if not found
      const grpName=grpRows[0].name||grpId;
      const grpDest=grpRows[0].destination||"";
      const members=typeof grpRows[0].members==="string"?JSON.parse(grpRows[0].members):(grpRows[0].members||[]);
      const emails=members.map(m=>m.email).filter(e=>e&&e.includes("@")&&!e.startsWith(token.email));
      if(!emails.length)return ok({success:true,notified:0},event);
      const callerDisplay=authorName||"Your group organizer";
      const grpUrl="https://www.uniprofile.net/";
      const bodyHtml=[
        '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F6F3">',
        '<div style="background:#fff;border:1px solid #E5E4E0;border-radius:12px;padding:32px">',
        '<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#111;margin-bottom:4px">UniProfile</div>',
        '<div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px">Travel Identity Platform</div>',
        '<p style="font-size:15px;color:#111827;margin:0 0 8px"><strong>'+callerDisplay+'</strong> added a note to <strong>'+grpName+(grpDest?' &middot; '+grpDest:'')+'</strong>.</p>',
        noteText?'<p style="font-size:13px;color:#374151;background:#F9FAFB;border-left:2px solid #C4A882;padding:12px 16px;border-radius:4px;margin:0 0 20px;white-space:pre-wrap">'+noteText+'</p>':'',
        '<a href="'+grpUrl+'" style="display:inline-block;background:#B45309;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">View Group</a>',
        '</div></div>'
      ].join("");
      let notified=0;
      for(const email of emails.slice(0,20)){
        try{
          await sesClient.send(new SendEmailCommand({
            FromEmailAddress:"invites@uniprofile.net",
            Destination:{ToAddresses:[email]},
            Content:{Simple:{Subject:{Data:"New note in "+grpName,Charset:"UTF-8"},Body:{Html:{Data:bodyHtml,Charset:"UTF-8"},Text:{Data:callerDisplay+" added a note: "+(noteText||"(see attachment)"),Charset:"UTF-8"}}}},
          }));
          notified++;
        }catch(e){console.warn("note-alert email failed:",e.message);}
      }
      return ok({success:true,notified},event);
    }
    // POST /api/v1/groups/{grp_id}/share
    if(method==="POST"&&path.match(/\/api\/v1\/groups\/[^/]+\/share$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");
      const grpId=parts[parts.length-2];
      const{uniprofile_id,message:shareMsg}=body;
      if(!uniprofile_id)return err("uniprofile_id required",event,400);
      const upid=uniprofile_id.trim().toUpperCase();
      if(!/^UP-\d{6}$/.test(upid))return err("Invalid UniProfile ID format — expected UP-XXXXXX",event,400);
      // Verify caller owns this group
      const grpRows=await sql("SELECT id FROM traveler_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",grpId),uuidParam("u",myUuid)]);
      if(!grpRows.length)return err("Group not found or access denied",event,404);
      // Look up target traveler
      const targetRows=await sql("SELECT uuid,email FROM travelers WHERE uniprofile_number=:upid",[strParam("upid",upid)]);
      if(!targetRows.length)return err("UniProfile ID not found",event,404);
      const targetUuid=targetRows[0].uuid;
      const targetEmail=targetRows[0].email;
      if(targetUuid===myUuid)return err("Cannot share a group with yourself",event,400);
      // Get caller name for notification
      const callerIdentity=await sql("SELECT legal_first,legal_last FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",myUuid)]);
      const callerName=callerIdentity[0]?[callerIdentity[0].legal_first,callerIdentity[0].legal_last].filter(Boolean).join(" "):"A UniProfile user";
      const targetIdentity=await sql("SELECT legal_first,legal_last FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",targetUuid)]);
      const targetName=targetIdentity[0]?[targetIdentity[0].legal_first,targetIdentity[0].legal_last].filter(Boolean).join(" ")||upid:upid;
      // Get group name for notification
      const grpDetail=await sql("SELECT name,destination FROM traveler_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",grpId),uuidParam("u",myUuid)]);
      const grpName=grpDetail[0]?grpDetail[0].name:grpId;
      const grpDest=grpDetail[0]?grpDetail[0].destination:"";
      // Record the share
      await sql("INSERT INTO group_shares (group_id,owner_uuid,shared_with_uuid,message,status) VALUES (:gid,:owner,:target,:msg,'pending') ON CONFLICT (group_id,shared_with_uuid) DO UPDATE SET message=:msg,status='pending',created_at=NOW()",[strParam("gid",grpId),uuidParam("owner",myUuid),uuidParam("target",targetUuid),strParam("msg",shareMsg||null)]);
      // Send notification email (non-fatal)
      try{
        const acceptUrl="https://www.uniprofile.net/#group-share="+grpId;
        const bodyHtml=[
          '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F6F3">',
          '<div style="background:#fff;border:1px solid #E5E4E0;border-radius:12px;padding:32px">',
          '<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#111;margin-bottom:4px">UniProfile</div>',
          '<div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px">Travel Identity Platform</div>',
          '<p style="font-size:15px;color:#111827;margin:0 0 12px"><strong>'+callerName+'</strong> shared a travel group with you.</p>',
          '<p style="font-size:14px;color:#374151;margin:0 0 8px"><strong>Group:</strong> '+grpName+(grpDest?' &middot; '+grpDest:'')+'</p>',
          shareMsg?'<p style="font-size:13px;color:#374151;background:#F9FAFB;border-left:2px solid #E5E4E0;padding:12px 16px;border-radius:4px;margin:0 0 20px"><em>&ldquo;'+shareMsg+'&rdquo;</em></p>':'',
          '<a href="'+acceptUrl+'" style="display:inline-block;background:#B45309;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">View Group</a>',
          '</div></div>'
        ].join("");
        await sesClient.send(new SendEmailCommand({
          FromEmailAddress:"invites@uniprofile.net",
          Destination:{ToAddresses:[targetEmail]},
          Content:{Simple:{Subject:{Data:callerName+" shared a group with you on UniProfile",Charset:"UTF-8"},Body:{Html:{Data:bodyHtml,Charset:"UTF-8"},Text:{Data:callerName+" shared group \""+grpName+"\" with you. View it at "+acceptUrl,Charset:"UTF-8"}}}},
        }));
      }catch(emailErr){console.warn("Share notification email failed:",emailErr.message);}
      return ok({success:true,shared_with_name:targetName},event);
    }
    return err("Not found",event,404);
  }catch(e){
    if(e.status)return err(e.message,event,e.status);
    console.error("Unhandled error:",e);
    return{statusCode:500,headers:cors(go(event)),body:JSON.stringify({error:"Internal server error"})};
  }
};
