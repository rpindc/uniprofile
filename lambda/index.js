const { RDSDataClient, ExecuteStatementCommand } = require("@aws-sdk/client-rds-data");
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminInitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const rds = new RDSDataClient({ region: process.env.AWS_REGION || "us-east-1" });
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const DOCS_BUCKET = process.env.TRIP_DOCS_BUCKET || "uniprofile-trip-documents";
const DB = { resourceArn: process.env.AURORA_CLUSTER_ARN, secretArn: process.env.AURORA_SECRET_ARN, database: process.env.DB_NAME || "uniprofile" };
const verifier = CognitoJwtVerifier.create({ userPoolId: process.env.COGNITO_USER_POOL_ID, tokenUse: "id", clientId: process.env.COGNITO_CLIENT_ID });
async function sql(query, params = []) {
  try { const res = await rds.send(new ExecuteStatementCommand({ ...DB, sql: query, parameters: params, formatRecordsAs: "JSON" })); return res.formattedRecords ? JSON.parse(res.formattedRecords) : []; }
  catch (e) { console.error("SQL Error:", e.message, "Q:", query.slice(0,100)); throw e; }
}
const uuidParam=(n,v)=>({name:n,value:{stringValue:v},typeHint:"UUID"});
const strParam=(n,v)=>({name:n,value:(v!=null&&v!==''&&v!=='null')?{stringValue:String(v)}:{isNull:true}});
const boolParam=(n,v)=>({name:n,value:v!=null?{booleanValue:Boolean(v)}:{isNull:true}});
const numParam=(n,v)=>({name:n,value:v!=null?{doubleValue:Number(v)}:{isNull:true}});
const dateParam=(n,v)=>(v&&v!==''&&v!=='null')?{name:n,value:{stringValue:String(v)},typeHint:"DATE"}:{name:n,value:{isNull:true}};
function avatarColorFromName(name){const c=['info','warm','cool','muted'];let h=0,s=(name||'').trim().toLowerCase();for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return c[Math.abs(h)%4];}
const _searchRL={};
const RULES=require('./admissibility_rules.json');
function generateGroupId(){const {randomBytes}=require('crypto');return 'GRP-'+String(randomBytes(3).readUInt32BE(0)%1000000).padStart(6,'0');}
function generateMemberId(){return 'mbr-'+Date.now()+Math.floor(Math.random()*10000);}
async function validateTripGroupId(groupId,ownerUuid){
  const rows=await sql("SELECT id,trip_id,archived_at FROM traveler_groups WHERE id=:id AND owner_uuid=:u",[strParam("id",groupId),uuidParam("u",ownerUuid)]);
  if(!rows||!rows.length)throw{status:404,message:"Trip Group not found"};
  return rows[0];
}
async function validateTripGroupAccess(groupId,callerUuid){
  const owned=await sql("SELECT id,trip_id,archived_at,members,owner_uuid FROM traveler_groups WHERE id=:id AND owner_uuid=:u",[strParam("id",groupId),uuidParam("u",callerUuid)]);
  if(owned.length)return{row:owned[0],role:'organizer'};
  const joined=await sql("SELECT tg.id,tg.trip_id,tg.archived_at,tg.members,tg.owner_uuid FROM traveler_groups tg JOIN trip_group_consents c ON c.trip_group_id=tg.id WHERE tg.id=:id AND c.target_uuid=:u AND c.status='approved'",[strParam("id",groupId),uuidParam("u",callerUuid)]);
  if(joined.length)return{row:joined[0],role:'member'};
  throw{status:404,message:"Trip Group not found"};
}
async function writeAuditLog(groupId,actorUuid,action,targetUuid,payload){
  try{
    const{randomBytes}=require('crypto');
    const b=randomBytes(16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
    const id=b.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
    const tgtParam=targetUuid?uuidParam("tgt",targetUuid):{name:"tgt",value:{isNull:true}};
    await sql("INSERT INTO trip_group_audit_log(id,trip_group_id,actor_uuid,action,target_uuid,payload) VALUES(:id::uuid,:gid,:actor::uuid,:action,:tgt::uuid,:payload::jsonb)",
      [strParam("id",id),strParam("gid",groupId),strParam("actor",actorUuid),strParam("action",action),tgtParam,strParam("payload",JSON.stringify(payload||{}))]);
  }catch(e){console.warn("audit log write failed:",e.message);}
}
async function writeNotification(recipientUuid,groupId,kind,payload){
  try{
    const{randomBytes}=require('crypto');
    const b=randomBytes(16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
    const id=b.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
    await sql("INSERT INTO trip_group_notifications(id,recipient_uuid,trip_group_id,kind,payload) VALUES(:id::uuid,:u::uuid,:gid,:kind,:payload::jsonb)",
      [strParam("id",id),strParam("u",recipientUuid),strParam("gid",groupId),strParam("kind",kind),strParam("payload",JSON.stringify(payload||{}))]);
  }catch(e){console.warn("notification write failed:",e.message);}
}
async function getTravelerDisplayName(uuid){
  try{
    const rows=await sql("SELECT i.legal_first,i.legal_last,t.email FROM travelers t LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE t.uuid=:u",[uuidParam("u",uuid)]);
    if(!rows.length)return"A UniProfile member";
    const r=rows[0];
    return[r.legal_first,r.legal_last].filter(Boolean).join(' ')||r.email||"A UniProfile member";
  }catch(e){return"A UniProfile member";}
}
async function sendGroupInviteEmail(targetEmail,organizerName,groupName,destination,consentId){
  const inviteUrl="https://www.uniprofile.net/trip-group-invite.html?c="+consentId;
  const destDisplay=destination?(RULES[destination]||{}).name||destination:'';
  const bodyHtml=[
    '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F6F3">',
    '<div style="background:#fff;border:1px solid #E5E4E0;border-radius:12px;padding:32px">',
    '<div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#111;margin-bottom:4px">UniProfile</div>',
    '<div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px">Travel Identity Platform</div>',
    '<p style="font-size:15px;color:#111827;margin:0 0 8px"><strong>'+organizerName+'</strong> added you to a trip group.</p>',
    '<p style="font-size:14px;color:#374151;margin:0 0 20px"><strong>'+groupName+(destDisplay?' &middot; '+destDisplay:'')+'</strong></p>',
    '<p style="font-size:13px;color:#6B7280;margin:0 0 24px">They\'d like to share travel documents for this trip. You can review and accept or decline.</p>',
    '<a href="'+inviteUrl+'" style="display:inline-block;background:#B45309;color:#fff;font-size:14px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">View Invitation</a>',
    '<p style="font-size:11px;color:#9CA3AF;margin:24px 0 0">You must be signed in to UniProfile to respond to this invitation.</p>',
    '</div></div>'
  ].join('');
  await sesClient.send(new SendEmailCommand({
    FromEmailAddress:'invites@uniprofile.net',
    Destination:{ToAddresses:[targetEmail]},
    Content:{Simple:{Subject:{Data:organizerName+' added you to a trip group on UniProfile',Charset:'UTF-8'},Body:{Html:{Data:bodyHtml,Charset:'UTF-8'},Text:{Data:organizerName+' added you to "'+groupName+'" on UniProfile. View the invitation at '+inviteUrl,Charset:'UTF-8'}}}},
  }));
}
function evaluateAdmissibility(docs,destinationIata,returnDate){
  const entry=RULES[destinationIata];
  if(!entry)return{destination:destinationIata,destination_name:destinationIata,checks:[],overall_status:'n/a',rule_source:'hardcoded_v1',disclaimer:RULES._meta.disclaimer};
  const passport=docs.find(function(d){return(d.document_type||d.doc_type||'').toUpperCase()==='PASSPORT';});
  const retDate=returnDate?new Date(returnDate):null;
  const now=new Date();
  const checks=[];let hasBlock=false,hasWarning=false;
  for(const rule of entry.rules){
    if(rule.type==='informational'){checks.push({id:rule.id,label:rule.label,status:'info',detail:rule.note});continue;}
    if(!passport){checks.push({id:rule.id,label:rule.label,status:'failed',detail:'No passport on file'});hasBlock=true;continue;}
    const expiry=new Date(passport.date_of_expiry||passport.expiry_date);
    if(rule.type==='passport_validity_duration_only'){
      const checkDate=retDate||now;
      if(expiry<=checkDate){checks.push({id:rule.id,label:rule.label,status:'failed',detail:'Passport expires '+expiry.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' — before or on return date'});hasBlock=true;}
      else{checks.push({id:rule.id,label:rule.label,status:'passed',detail:'Valid through '+expiry.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})});}
    } else if(rule.type==='passport_validity_after_exit'){
      const threshold=new Date(retDate||now);threshold.setMonth(threshold.getMonth()+(rule.min_months_after_exit||3));
      if(expiry<threshold){
        const detail='Passport expires '+expiry.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' — must be valid '+rule.min_months_after_exit+'+ months after return date';
        if(expiry<=now){checks.push({id:rule.id,label:rule.label,status:'failed',detail});hasBlock=true;}
        else{checks.push({id:rule.id,label:rule.label,status:'warning',detail});hasWarning=true;}
      } else{checks.push({id:rule.id,label:rule.label,status:'passed',detail:'Valid through '+expiry.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})});}
    }
  }
  return{destination:destinationIata,destination_name:entry.name,checks,overall_status:hasBlock?'blocked':hasWarning?'action_needed':'ready',rule_source:'hardcoded_v1',disclaimer:RULES._meta.disclaimer};
}
/* ── UniProfile ID — spec v1.0 ───────────────────────────────────────────── */
const UP_ALPHABET='23456789ABCDEFGHJKMNPQRSTVWXYZ'; // 30 chars, no 0/O/1/I/L/U
const UP_WEIGHTS=[2,3,5,7,11,13,17];
function generateUpId(){
  const {randomBytes}=require('crypto');
  const body=[];
  for(let i=0;i<7;i++){
    const v=randomBytes(4).readUInt32BE(0)%UP_ALPHABET.length;
    body.push(UP_ALPHABET[v]);
  }
  const sum=body.reduce((acc,ch,i)=>acc+UP_ALPHABET.indexOf(ch)*UP_WEIGHTS[i],0);
  body.push(UP_ALPHABET[sum%UP_ALPHABET.length]);
  return'UP-'+body.slice(0,4).join('')+'-'+body.slice(4).join('');
}
function validateUpId(id){
  if(!id||id.length!==12)return false;
  if(!id.startsWith('UP-'))return false;
  if(id[7]!=='-')return false;
  const body=id.slice(3,7)+id.slice(8);
  if(![...body].every(c=>UP_ALPHABET.includes(c)))return false;
  const sum=[...body.slice(0,7)].reduce((acc,ch,i)=>acc+UP_ALPHABET.indexOf(ch)*UP_WEIGHTS[i],0);
  return body[7]===UP_ALPHABET[sum%UP_ALPHABET.length];
}
/* ─────────────────────────────────────────────────────────────────────────── */
const ORIGINS=["https://www.uniprofile.net","https://main.d3dngzji06baij.amplifyapp.com","http://localhost:3000","http://localhost:5173"];
const cors=(o)=>{const a=ORIGINS.includes(o)?o:ORIGINS[0];return{"Content-Type":"application/json","Access-Control-Allow-Origin":a,"Access-Control-Allow-Headers":"Content-Type,Authorization,x-uniprofile-key","Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS","Access-Control-Allow-Credentials":"true"};};
const go=(e)=>(e.headers&&(e.headers.origin||e.headers.Origin))||"";
const ok=(b,e,s=200)=>({statusCode:s,headers:cors(go(e)),body:JSON.stringify(b)});
const err=(m,e,s=400)=>({statusCode:s,headers:cors(go(e)),body:JSON.stringify({error:m})});
async function verifyToken(event){
  const auth=(event.headers&&(event.headers.Authorization||event.headers.authorization))||"";
  if(!auth.startsWith("Bearer ")) throw {status:401,message:"Authentication required"};
  try{return await verifier.verify(auth.slice(7));}catch(e){throw {status:401,message:"Invalid or expired token"};}
}
async function fetchEmailFromCognito(sub){
  try{
    const res=await cognito.send(new AdminGetUserCommand({UserPoolId:process.env.COGNITO_USER_POOL_ID,Username:sub}));
    const attr=res.UserAttributes&&res.UserAttributes.find(a=>a.Name==='email');
    return attr?attr.Value:null;
  }catch(e){console.error("AdminGetUser error:",e.message);return null;}
}
async function getOrCreateTraveler(sub,email){
  let rows=await sql("SELECT uuid,uniprofile_number FROM travelers WHERE cognito_sub=:sub",[strParam("sub",sub)]);
  if(rows.length){
    const existing=rows[0];
    if(!validateUpId(existing.uniprofile_number)){
      let newId=generateUpId();
      for(let retry=0;retry<5;retry++){
        const clash=await sql("SELECT 1 FROM travelers WHERE uniprofile_number=:id",[strParam("id",newId)]);
        if(!clash.length)break;
        newId=generateUpId();
      }
      await sql("UPDATE travelers SET uniprofile_number=:id WHERE uuid=:u",[strParam("id",newId),uuidParam("u",existing.uuid)]);
    }
    return existing.uuid;
  }
  let resolvedEmail=email;
  if(!resolvedEmail){
    console.warn("email missing from token for sub:",sub,"— fetching from Cognito");
    resolvedEmail=await fetchEmailFromCognito(sub);
    if(!resolvedEmail){console.error("Cannot resolve email for sub:",sub);return null;}
  }
  let upId=generateUpId();
  for(let retry=0;retry<5;retry++){
    const clash=await sql("SELECT 1 FROM travelers WHERE uniprofile_number=:id",[strParam("id",upId)]);
    if(!clash.length)break;
    upId=generateUpId();
  }
  rows=await sql("INSERT INTO travelers (cognito_sub,email,tier,gdpr_consent_at,uniprofile_number) VALUES (:sub,:email,'free',NOW(),:upid) ON CONFLICT (cognito_sub) DO UPDATE SET email=:email RETURNING uuid",[strParam("sub",sub),strParam("email",resolvedEmail),strParam("upid",upId)]);
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
    sql("SELECT profile_complete,tier,email,uniprofile_number,display_name FROM travelers WHERE uuid=:u",p),
    sql("SELECT context,preferred_card,company_name,cost_center,policy_description,expense_platform,corporate_card FROM payment_profiles WHERE traveler_uuid=:u ORDER BY context",p),
    sql("SELECT id,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,status,total_fare,currency,source_platform,notes FROM trips WHERE traveler_uuid=:u ORDER BY departure_date DESC LIMIT 50",p),
    sql("SELECT s.trip_id,s.id,s.segment_type,s.segment_order,s.carrier,s.flight_number,s.origin_iata,s.destination_iata,s.departure_datetime,s.arrival_datetime,s.cabin_class,s.seat_number,s.booking_ref,s.duration_minutes,s.aircraft_type FROM trip_segments s INNER JOIN trips t ON t.id=s.trip_id WHERE t.traveler_uuid=:u ORDER BY s.trip_id,s.segment_order",p),
    sql("SELECT ps.trip_id,ps.passenger_name,ps.ticket_number,ps.seat_number,ps.is_primary FROM trip_passengers ps INNER JOIN trips t ON t.id=ps.trip_id WHERE t.traveler_uuid=:u ORDER BY ps.trip_id,ps.is_primary DESC",p),
    sql("SELECT code,label,category,sort_order,fields_required,fields_optional FROM document_types WHERE is_active=TRUE ORDER BY sort_order",[]),
    sql("SELECT id,name,type,destination,dep::text,ret::text,members,flights,hotel,notes,trip_id::text,archived_at FROM traveler_groups WHERE owner_uuid=:u ORDER BY updated_at DESC",p),
    sql("SELECT module_name,data FROM traveler_profile_modules WHERE traveler_uuid=:u",p),
  ]);
  const [identity,docs,seat,meal,loyalty,bleisure,meta,payment,tripRows,segmentRows,passengerRows,docTypeRows,groupRows,moduleRows]=R;
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
  const tripGroupMap={};
  groupRows.forEach(function(g){if(g.trip_id)tripGroupMap[g.trip_id]=g.id;});
  const trips=tripRows.map(t=>{
    const dep=t.departure_date?new Date(t.departure_date):null;
    const ret=t.return_date?new Date(t.return_date):null;
    const daysUntil=dep?Math.floor((dep-now)/86400000):null;
    const status=!dep?"unknown":daysUntil>0?"upcoming":ret&&now<=ret?"in-progress":"completed";
    return Object.assign({},t,{days_until:daysUntil,status,segments:segsByTrip[t.id]||[],passengers:paxByTrip[t.id]||[],trip_group_id:tripGroupMap[t.id]||null});
  });
  const groups=groupRows.filter(function(g){return!g.trip_id;}).map(g=>({id:g.id,name:g.name,type:g.type,destination:g.destination,dep:g.dep,ret:g.ret,members:typeof g.members==="string"?JSON.parse(g.members):(g.members||[]),flights:typeof g.flights==="string"?JSON.parse(g.flights):(g.flights||[]),hotel:g.hotel?(typeof g.hotel==="string"?JSON.parse(g.hotel):g.hotel):null,notes:typeof g.notes==="string"?JSON.parse(g.notes):(g.notes||[])}));
  const profileModules={};
  moduleRows.forEach(r=>{try{profileModules[r.module_name]=typeof r.data==="string"?JSON.parse(r.data):r.data;}catch(e){profileModules[r.module_name]={};} });
  const _milestones=[
    !!(identity[0]&&identity[0].legal_first&&identity[0].legal_last),
    docsWithExpiry.some(d=>d.doc_type==="PASSPORT"),
    !!seat[0],
    loyalty.length>0,
    trips.length>0
  ];
  const profileCompleteness=Math.round(_milestones.filter(Boolean).length/_milestones.length*100);
  return {uuid,uniprofile_number:meta[0]&&meta[0].uniprofile_number||null,email:meta[0]&&meta[0].email,tier:meta[0]&&meta[0].tier||"free",profile_completeness:profileCompleteness,display_name:meta[0]&&meta[0].display_name||null,active_context:bleisure[0]&&bleisure[0].active_context||"PERSONAL",identity:identity[0]||null,documents:docsWithExpiry,document_types:docTypesGrouped,seat_preferences:seat[0]||null,meal_preferences:mealData,...profileModules,loyalty_programs:loyalty,payment_profiles:payment,trips,trips_count:trips.length,groups,generated_at:new Date().toISOString()};
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
    case "trip_add":{
      if(!data.destination_iata)throw {status:400,message:"destination_iata required"};
      await sql("INSERT INTO trips (traveler_uuid,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,source_platform,notes) VALUES (:u,:name,:pnr,:dep,:ret,:orig,:dest,:ctx,'manual',:notes)",[uuidParam("u",uuid),strParam("name",data.trip_name||(data.origin_iata||"?")+"-"+(data.destination_iata||"?")),strParam("pnr",data.trip_locator),dateParam("dep",data.departure_date),dateParam("ret",data.return_date),strParam("orig",data.origin_iata?data.origin_iata.toUpperCase().slice(0,3):null),strParam("dest",data.destination_iata?data.destination_iata.toUpperCase().slice(0,3):null),strParam("ctx",data.trip_context||"PERSONAL"),strParam("notes",data.notes)]);
      break;
    }
    case "trip_delete":
      await sql("DELETE FROM trips WHERE id=:tid AND traveler_uuid=:u",[uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      break;
    case "trip_verify":
      if(!data.trip_id||!data.action)throw {status:400,message:"trip_id and action required"};
      if(data.action==="confirm"){
        await sql("UPDATE trips SET status=CASE WHEN departure_date>NOW() THEN 'upcoming' ELSE 'completed' END,updated_at=NOW() WHERE id=:tid AND traveler_uuid=:u AND status='pending'",[uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      } else if(data.action==="reject"){
        await sql("DELETE FROM trips WHERE id=:tid AND traveler_uuid=:u AND status='pending'",[uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      } else {
        throw {status:400,message:"action must be confirm or reject"};
      }
      break;
    case "groups":
      // Bulk-replace path retired — groups are now managed via individual Trip Group endpoints
      break;
    case "trip_memory":{
      if(!data.trip_id)throw{status:400,message:"trip_id required"};
      const existing=await sql("SELECT notes FROM trips WHERE id=:tid AND traveler_uuid=:u",[uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      const prev=existing[0]&&existing[0].notes?JSON.parse(existing[0].notes.startsWith("{")?existing[0].notes:"{}"):{};
      const merged=Object.assign({},prev,{rating:data.rating||prev.rating,tags:data.tags||prev.tags,note:data.note||prev.note,feel:data.feel||prev.feel,saved_at:new Date().toISOString()});
      await sql("UPDATE trips SET notes=:n WHERE id=:tid AND traveler_uuid=:u",[strParam("n",JSON.stringify(merged)),uuidParam("tid",data.trip_id),uuidParam("u",uuid)]);
      break;
    }
    case "essentials":
    case "fly_preferences":
    case "travel_preferences":
      await sql("INSERT INTO traveler_profile_modules (traveler_uuid,module_name,data,updated_at) VALUES (:u,:mn,:data::jsonb,NOW()) ON CONFLICT (traveler_uuid,module_name) DO UPDATE SET data=:data::jsonb,updated_at=NOW()",[uuidParam("u",uuid),strParam("mn",module),strParam("data",JSON.stringify(data))]);
      break;
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
  const [myInsurance, myTours, namedOnly, groupCountRows] = await Promise.all([
    sql("SELECT id,provider,policy_number,coverage_summary,valid_from,valid_until,emergency_phone FROM traveler_insurance WHERE traveler_uuid=:u ORDER BY created_at DESC", p),
    sql("SELECT id,operator,tour_name,tour_date,duration,reference,meeting_point FROM traveler_tours WHERE traveler_uuid=:u ORDER BY tour_date DESC", p),
    sql("SELECT id,display_name,relationship,notes,avatar_color,created_at FROM people_named_only WHERE owner_uuid=:u ORDER BY created_at DESC", p),
    sql("SELECT m->>'upid' AS member_uuid, m->>'email' AS member_email, COUNT(DISTINCT tg.id) AS group_count FROM traveler_groups tg CROSS JOIN LATERAL jsonb_array_elements(tg.members) AS m WHERE tg.owner_uuid=:u GROUP BY m->>'upid', m->>'email'", p),
  ]);
  const gcByUuid = {}, gcByEmail = {};
  groupCountRows.forEach(function(row) {
    if (row.member_uuid) gcByUuid[row.member_uuid] = Number(row.group_count) || 0;
    if (row.member_email) gcByEmail[row.member_email.toLowerCase()] = Number(row.group_count) || 0;
  });
  return {
    linked: linked.map(function(l) { return Object.assign({}, l, {group_count: gcByUuid[l.uuid] || gcByEmail[(l.email||'').toLowerCase()] || 0}); }),
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
      group_count: gcByEmail[((s.target_email||s.to_email)||'').toLowerCase()] || 0,
    })),
    named_only: namedOnly,
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
    if(method==="POST"&&path==="/api/v1/feedback"){
      const {name,email,message,_gotcha}=body;
      if(_gotcha)return ok({success:true},event); // honeypot
      if(!message||message.trim().length<3)return err("Message is required",event,400);
      const fromName=(name||"Anonymous").slice(0,100);
      const fromEmail=(email||"no-reply@uniprofile.net").slice(0,200);
      const bodyHtml=[
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;background:#F7F6F3">',
        '<div style="background:#fff;border:1px solid #E5E4E0;border-radius:10px;padding:28px">',
        '<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#111;margin-bottom:4px">UniProfile Feedback</div>',
        '<div style="font-size:11px;color:#9CA3AF;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px">Early access</div>',
        '<p style="font-size:13px;color:#6B7280;margin:0 0 6px"><strong>From:</strong> '+fromName+' &lt;'+fromEmail+'&gt;</p>',
        '<div style="background:#F9FAFB;border:1px solid #E5E4E0;border-radius:6px;padding:16px;margin-top:16px;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap">'+message.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>',
        '</div></div>'
      ].join('');
      try{
        await sesClient.send(new SendEmailCommand({
          FromEmailAddress:'invites@uniprofile.net',
          Destination:{ToAddresses:['rommel@uniworldinc.com']},
          ReplyToAddresses:email?[email]:[],
          Content:{Simple:{
            Subject:{Data:'UniProfile feedback from '+fromName,Charset:'UTF-8'},
            Body:{Html:{Data:bodyHtml,Charset:'UTF-8'},Text:{Data:'From: '+fromName+' <'+fromEmail+'>\n\n'+message,Charset:'UTF-8'}}
          }}
        }));
      }catch(sesErr){
        console.error('Feedback SES error:',sesErr.message);
        return err('Could not send feedback — please try again',event,500);
      }
      return ok({success:true},event);
    }
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
      console.log("PUT module=",body.module,"hasData=",!!body.data,"isBase64=",event.isBase64Encoded,"rawBody=",event.body?String(event.body).slice(0,300):"null");
      if(!body.module||!body.data)return err("Missing module or data",event,400);
      await updateModule(uuid,body.module,body.data);
      const _modEvtMap={identity:["identity_updated",{}],document_add:["document_added",{doc_type:body.data.doc_type}],document_update:["document_updated",{doc_type:body.data.doc_type}],document_delete:["document_deleted",{}],trip_add:["trip_added",{destination:body.data.destination_iata}],trip_delete:["trip_deleted",{}]};
      const _modEvt=_modEvtMap[body.module];
      if(_modEvt)await logSecEvent(uuid,_modEvt[0],_modEvt[1],event);
      return ok({success:true,module:body.module,profile:await buildProfile(uuid)},event);
    }
    if(method==="GET"&&path.indexOf("/bleisure")!==-1){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
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
      await logSecEvent(uuid,"context_switched",{context},event);
      return ok({success:true,active_context:context},event);
    }
    if(method==="POST"&&path.indexOf("/transactions/")!==-1){
      const key=event.headers&&event.headers["x-uniprofile-key"];
      if(!key)return err("Platform authentication required",event,401);
      const storedKey=process.env.PLATFORM_KEY||"";
      if(!storedKey)return err("Platform not configured",event,503);
      const{createHash,timingSafeEqual}=require('crypto');
      const provided=createHash('sha256').update(key).digest();
      const expected=createHash('sha256').update(storedKey).digest();
      if(!timingSafeEqual(provided,expected))return err("Platform authentication required",event,401);
      const t=body;
      const tripRows=await sql("INSERT INTO trips (traveler_uuid,trip_name,trip_locator,departure_date,return_date,origin_iata,destination_iata,trip_context,source_platform,total_fare,currency) VALUES (:u,:name,:pnr,:dep,:ret,:orig,:dest,:ctx,:src,:fare,:cur) RETURNING id",[uuidParam("u",uuid),strParam("name",t.trip_name||(t.origin_iata+"-"+t.destination_iata)),strParam("pnr",t.pnr),dateParam("dep",t.departure_date),dateParam("ret",t.return_date),strParam("orig",t.origin_iata),strParam("dest",t.destination_iata),strParam("ctx",t.trip_context||"PERSONAL"),strParam("src","platform"),numParam("fare",t.total_fare),strParam("cur",t.currency||"USD")]);
      const tripId=tripRows[0]&&tripRows[0].id;
      if(tripId&&t.carrier)await sql("INSERT INTO trip_segments (trip_id,segment_type,segment_order,carrier,flight_number,origin_iata,destination_iata,cabin_class,booking_ref) VALUES (:tid,'FLIGHT',1,:car,:flt,:orig,:dest,:cab,:ref)",[strParam("tid",tripId),strParam("car",t.carrier),strParam("flt",t.flight_number),strParam("orig",t.origin_iata),strParam("dest",t.destination_iata),strParam("cab",t.cabin_class),strParam("ref",t.pnr)]);
      return ok({success:true,trip_id:tripId},event,201);
    }
    if(method==="GET"&&(path.indexOf("/alerts/")!==-1||path.endsWith("/alerts"))){
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
    // ── People Routes ─────────────────────────────────────────────────────
    // GET /api/v1/people/search-uniprofile?q=<query>
    if(method==="GET"&&path==="/api/v1/people/search-uniprofile"){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const q=((event.queryStringParameters||{}).q||"").trim().slice(0,80);
      if(!q||q.length<2)return ok([],event);
      // Rate limit: 30 queries per minute per user
      const now=Date.now();
      if(!_searchRL[myUuid])_searchRL[myUuid]=[];
      _searchRL[myUuid]=_searchRL[myUuid].filter(t=>now-t<60000);
      if(_searchRL[myUuid].length>=30)return{statusCode:429,headers:cors(go(event)),body:JSON.stringify({error:"Too many requests"})};
      _searchRL[myUuid].push(now);
      // Log for abuse detection
      await logSecEvent(myUuid,'people_search',{q},event);
      const isUpId=/^UP-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(q.trim());
      let rows=[];
      if(isUpId){
        rows=await sql("SELECT t.uuid,t.uniprofile_number AS up_id,i.legal_first,i.legal_last,EXTRACT(YEAR FROM t.created_at)::int AS joined_year FROM travelers t LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE UPPER(t.uniprofile_number)=UPPER(:q) AND t.uuid<>:u LIMIT 10",[strParam("q",q.trim()),uuidParam("u",myUuid)]);
      } else {
        rows=await sql("SELECT t.uuid,t.uniprofile_number AS up_id,i.legal_first,i.legal_last,EXTRACT(YEAR FROM t.created_at)::int AS joined_year FROM travelers t LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE (LOWER(i.legal_first)||' '||LOWER(i.legal_last) LIKE :q OR LOWER(i.legal_first) LIKE :q2 OR LOWER(i.legal_last) LIKE :q2) AND t.uuid<>:u LIMIT 15",[strParam("q",'%'+q.toLowerCase()+'%'),strParam("q2",q.toLowerCase()+'%'),uuidParam("u",myUuid)]);
      }
      return ok(rows.map(r=>({up_id:r.up_id||null,display_name:[r.legal_first,r.legal_last].filter(Boolean).join(" ")||"UniProfile User",joined_year:r.joined_year||null,member_uuid:r.uuid})),event);
    }
    // POST /api/v1/people/named-only
    if(method==="POST"&&path==="/api/v1/people/named-only"){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const {display_name,relationship,notes}=body;
      if(!display_name||!display_name.trim())return err("display_name is required",event,400);
      const dn=display_name.trim().slice(0,120);
      const color=avatarColorFromName(dn);
      const rows=await sql("INSERT INTO people_named_only(owner_uuid,display_name,relationship,notes,avatar_color) VALUES(:u,:dn,:rel,:notes,:color) RETURNING id,display_name,relationship,notes,avatar_color,created_at",
        [uuidParam("u",myUuid),strParam("dn",dn),strParam("rel",(relationship||"").slice(0,40)||null),strParam("notes",(notes||"").slice(0,2000)||null),strParam("color",color)]);
      const row=rows[0];
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'person_added_named_only',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({named_only_id:row.id,display_name:row.display_name}))]);
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify(row)};
    }
    // PATCH /api/v1/people/named-only/{id}
    if(method==="PATCH"&&path.startsWith("/api/v1/people/named-only/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const noId=path.replace("/api/v1/people/named-only/","");
      if(!noId||!/^[0-9a-f-]{36}$/i.test(noId))return err("Invalid id",event,400);
      const {display_name,relationship,notes}=body;
      const dn=(display_name||"").trim().slice(0,120);
      if(!dn)return err("display_name is required",event,400);
      const color=avatarColorFromName(dn);
      const rows=await sql("UPDATE people_named_only SET display_name=:dn,relationship=:rel,notes=:notes,avatar_color=:color,updated_at=NOW() WHERE id=:id AND owner_uuid=:u RETURNING id,display_name,relationship,notes,avatar_color,created_at",
        [strParam("dn",dn),strParam("rel",(relationship||"").slice(0,40)||null),strParam("notes",(notes||"").slice(0,2000)||null),strParam("color",color),uuidParam("id",noId),uuidParam("u",myUuid)]);
      if(!rows||!rows.length)return err("Not found",event,404);
      return ok(rows[0],event);
    }
    // DELETE /api/v1/people/named-only/{id}
    if(method==="DELETE"&&path.startsWith("/api/v1/people/named-only/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const noId=path.replace("/api/v1/people/named-only/","");
      if(!noId||!/^[0-9a-f-]{36}$/i.test(noId))return err("Invalid id",event,400);
      const rows=await sql("DELETE FROM people_named_only WHERE id=:id AND owner_uuid=:u RETURNING display_name",
        [uuidParam("id",noId),uuidParam("u",myUuid)]);
      if(!rows||!rows.length)return err("Not found",event,404);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'person_removed_named_only',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({named_only_id:noId,display_name:rows[0].display_name}))]);
      return ok({success:true},event);
    }
    // ── Trip Group Routes ─────────────────────────────────────────────────
    // POST /api/v1/trips/{trip_uuid}/group — create Trip Group from a trip
    if(method==="POST"&&path.match(/^\/api\/v1\/trips\/[^/]+\/group$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const tripId=parts[3];
      const tripRows=await sql("SELECT id,trip_name,destination_iata,return_date FROM trips WHERE id=:tid AND traveler_uuid=:u",[uuidParam("tid",tripId),uuidParam("u",myUuid)]);
      if(!tripRows||!tripRows.length)return err("Trip not found",event,404);
      const trip=tripRows[0];
      const existing=await sql("SELECT id FROM traveler_groups WHERE trip_id=:tid AND owner_uuid=:u",[uuidParam("tid",tripId),uuidParam("u",myUuid)]);
      if(existing&&existing.length)return err("Trip Group already exists for this trip",event,409);
      const groupId=generateGroupId();
      const groupName=(body.name||(trip.trip_name||trip.destination_iata||'Trip')+' group').slice(0,120);
      const selfMember={id:generateMemberId(),kind:'self',linked_uuid:myUuid,named_only_id:null,display_name:'You',role:'organizer',avatar_color:avatarColorFromName(myUuid)};
      // Parse passengers from trip as named-only stubs
      const passengerRows=await sql("SELECT passenger_name FROM trip_passengers WHERE trip_id=:tid AND is_primary=FALSE",[uuidParam("tid",tripId)]);
      const members=[selfMember];
      for(const pax of (passengerRows||[])){
        if(!pax.passenger_name)continue;
        const namedRows=await sql("INSERT INTO people_named_only(owner_uuid,display_name,avatar_color) VALUES(:u,:dn,:color) RETURNING id",
          [uuidParam("u",myUuid),strParam("dn",pax.passenger_name.slice(0,120)),strParam("color",avatarColorFromName(pax.passenger_name))]);
        if(namedRows&&namedRows[0])members.push({id:generateMemberId(),kind:'named_only',named_only_id:namedRows[0].id,linked_uuid:null,display_name:pax.passenger_name,role:'member',avatar_color:avatarColorFromName(pax.passenger_name)});
      }
      await sql("INSERT INTO traveler_groups(id,owner_uuid,name,type,destination,trip_id,members,flights,hotel,notes) VALUES(:id,:u,:name,'trip',:dest,:tid,:members::jsonb,'[]'::jsonb,NULL,'[]'::jsonb)",
        [strParam("id",groupId),uuidParam("u",myUuid),strParam("name",groupName),strParam("dest",trip.destination_iata||null),uuidParam("tid",tripId),strParam("members",JSON.stringify(members))]);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'trip_group_created',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({trip_group_id:groupId,trip_id:tripId}))]);
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify({id:groupId,name:groupName,members,trip_id:tripId})};
    }
    // GET /api/v1/trip-groups — list all Trip Groups for the user (owned + joined)
    if(method==="GET"&&path==="/api/v1/trip-groups"){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const p=[uuidParam("u",myUuid)];
      const [ownedRows,joinedRows]=await Promise.all([
        sql("SELECT tg.id,tg.name,tg.destination,tg.trip_id::text,tg.archived_at,tg.created_at,tg.updated_at,tg.members,t.trip_name,t.departure_date,t.return_date,t.destination_iata FROM traveler_groups tg LEFT JOIN trips t ON t.id=tg.trip_id WHERE tg.owner_uuid=:u AND tg.trip_id IS NOT NULL ORDER BY tg.updated_at DESC",p),
        sql("SELECT tg.id,tg.name,tg.destination,tg.trip_id::text,tg.archived_at,tg.created_at,tg.updated_at,tg.members,t.trip_name,t.departure_date,t.return_date,t.destination_iata FROM traveler_groups tg LEFT JOIN trips t ON t.id=tg.trip_id JOIN trip_group_consents c ON c.trip_group_id=tg.id WHERE c.target_uuid=:u AND c.status='approved' AND tg.trip_id IS NOT NULL ORDER BY tg.updated_at DESC",p),
      ]);
      const mapRow=function(r,role){
        const members=typeof r.members==="string"?JSON.parse(r.members):(r.members||[]);
        return{id:r.id,name:r.name,destination:r.destination_iata||r.destination,destination_name:(RULES[r.destination_iata||'']||{}).name||r.destination,trip_id:r.trip_id,trip_name:r.trip_name,departure_date:r.departure_date,return_date:r.return_date,member_count:members.length,archived_at:r.archived_at,created_at:r.created_at,updated_at:r.updated_at,role};
      };
      const owned=ownedRows.map(function(r){return mapRow(r,'organizer');});
      const ownedIds=new Set(owned.map(function(r){return r.id;}));
      const joined=joinedRows.filter(function(r){return!ownedIds.has(r.id);}).map(function(r){return mapRow(r,'member');});
      const all=owned.concat(joined).sort(function(a,b){return new Date(b.updated_at)-new Date(a.updated_at);});
      return ok(all,event);
    }
    // GET /api/v1/trip-groups/{group_id}
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+$/)&&!path.includes('/members')&&!path.includes('/consents')&&!path.includes('/readiness')&&!path.includes('/archive')&&!path.includes('/workspace')&&!path.includes('/audit-log')&&!path.includes('/leave')){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const [groupRows,consents]=await Promise.all([
        sql("SELECT tg.*,tg.trip_id::text AS trip_id_str,t.trip_name,t.departure_date,t.return_date,t.destination_iata,u.email AS owner_email,i.legal_first AS owner_first,i.legal_last AS owner_last FROM traveler_groups tg LEFT JOIN trips t ON t.id=tg.trip_id LEFT JOIN travelers u ON u.uuid=tg.owner_uuid LEFT JOIN traveler_identity i ON i.traveler_uuid=tg.owner_uuid WHERE tg.id=:id",[strParam("id",groupId)]),
        role==='organizer'?sql("SELECT id,target_uuid,status,requested_scopes,granted_scopes,requested_at,responded_at FROM trip_group_consents WHERE trip_group_id=:id",[strParam("id",groupId)]):Promise.resolve([]),
      ]);
      const row=groupRows[0];
      const members=typeof row.members==="string"?JSON.parse(row.members):(row.members||[]);
      const resp={id:row.id,name:row.name,destination:row.destination_iata||row.destination,destination_name:(RULES[row.destination_iata||'']||{}).name||row.destination,trip_id:row.trip_id_str,trip_name:row.trip_name,departure_date:row.departure_date,return_date:row.return_date,archived_at:row.archived_at,members,role};
      if(role==='organizer')resp.consents=consents.map(function(c){try{return Object.assign({},c,{requested_scopes:typeof c.requested_scopes==='string'?JSON.parse(c.requested_scopes):(c.requested_scopes||[]),granted_scopes:typeof c.granted_scopes==='string'?JSON.parse(c.granted_scopes):(c.granted_scopes||null)});}catch(e){return c;}});
      if(role==='member')resp.organizer_name=[row.owner_first,row.owner_last].filter(Boolean).join(' ')||row.owner_email||null;
      return ok(resp,event);
    }
    // PATCH /api/v1/trip-groups/{group_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+$/)&&!path.includes('/members')&&!path.includes('/consents')&&!path.includes('/readiness')&&!path.includes('/archive')){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      const {name,notes}=body;
      if(name){await sql("UPDATE traveler_groups SET name=:name,updated_at=NOW() WHERE id=:id AND owner_uuid=:u",[strParam("name",name.slice(0,120)),strParam("id",groupId),uuidParam("u",myUuid)]);writeAuditLog(groupId,myUuid,'group_renamed',null,{name:name.slice(0,120)});}
      return ok({success:true},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+$/)&&!path.includes('/members')&&!path.includes('/consents')){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      writeAuditLog(groupId,myUuid,'group_deleted',null,{});
      await sql("DELETE FROM trip_group_consents WHERE trip_group_id=:id",[strParam("id",groupId)]);
      await sql("DELETE FROM traveler_groups WHERE id=:id AND owner_uuid=:u",[strParam("id",groupId),uuidParam("u",myUuid)]);
      return ok({success:true},event);
    }
    // POST /api/v1/trip-groups/{group_id}/archive
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/archive$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      await sql("UPDATE traveler_groups SET archived_at=NOW(),updated_at=NOW() WHERE id=:id AND owner_uuid=:u",[strParam("id",groupId),uuidParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'group_archived',null,{});
      return ok({success:true},event);
    }
    // POST /api/v1/trip-groups/{group_id}/members
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/members$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      const {kind,named_only_id,linked_uuid,display_name,relationship}=body;
      if(!kind||!['named_only','linked'].includes(kind))return err("kind must be 'named_only' or 'linked'",event,400);
      const groupRows=await sql("SELECT members FROM traveler_groups WHERE id=:id",[strParam("id",groupId)]);
      const members=typeof groupRows[0].members==="string"?JSON.parse(groupRows[0].members):(groupRows[0].members||[]);
      let memberId=generateMemberId(),namedId=named_only_id||null,linkedId=linked_uuid||null,memberName=display_name||'',color='muted';
      if(kind==='named_only'){
        if(!namedId){
          if(!display_name)return err("display_name required for new named-only member",event,400);
          color=avatarColorFromName(display_name);
          const nr=await sql("INSERT INTO people_named_only(owner_uuid,display_name,relationship,avatar_color) VALUES(:u,:dn,:rel,:color) RETURNING id",
            [uuidParam("u",myUuid),strParam("dn",display_name.slice(0,120)),strParam("rel",(relationship||null)),strParam("color",color)]);
          namedId=nr[0].id;
        } else {
          const nr=await sql("SELECT display_name,avatar_color FROM people_named_only WHERE id=:id AND owner_uuid=:u",[uuidParam("id",namedId),uuidParam("u",myUuid)]);
          if(!nr||!nr.length)return err("Named-only person not found",event,404);
          memberName=nr[0].display_name;color=nr[0].avatar_color;
        }
      } else {
        if(!linkedId)return err("linked_uuid required",event,400);
        const lr=await sql("SELECT CASE WHEN fl.requester_uuid=:u THEN i2.legal_first ELSE i1.legal_first END AS first, CASE WHEN fl.requester_uuid=:u THEN i2.legal_last ELSE i1.legal_last END AS last FROM family_links fl LEFT JOIN traveler_identity i1 ON i1.traveler_uuid=fl.requester_uuid LEFT JOIN traveler_identity i2 ON i2.traveler_uuid=fl.target_uuid WHERE (fl.requester_uuid=:u OR fl.target_uuid=:u) AND fl.status='accepted' AND (fl.requester_uuid=:lnk OR fl.target_uuid=:lnk)",
          [uuidParam("u",myUuid),uuidParam("lnk",linkedId)]);
        memberName=lr[0]?[lr[0].first,lr[0].last].filter(Boolean).join(' ')||'Linked person':'Linked person';
        color=avatarColorFromName(memberName);
        // Auto-create pending consent row
        const consentRows=await sql("INSERT INTO trip_group_consents(trip_group_id,requester_uuid,target_uuid,status,requested_scopes) VALUES(:gid,:u,:tgt,'pending','[\"passport_details\",\"dietary_preference\",\"seat_preference\"]'::jsonb) RETURNING id",
          [strParam("gid",groupId),uuidParam("u",myUuid),uuidParam("tgt",linkedId)]);
        const consentId=consentRows[0]&&consentRows[0].id;
        // Audit + notification + email (non-blocking)
        const [orgName,grpDetail,targetEmailRows]=await Promise.all([
          getTravelerDisplayName(myUuid),
          sql("SELECT name,t.destination_iata FROM traveler_groups tg LEFT JOIN trips t ON t.id=tg.trip_id WHERE tg.id=:id",[strParam("id",groupId)]),
          sql("SELECT email FROM travelers WHERE uuid=:u",[uuidParam("u",linkedId)]),
        ]);
        const grpName=(grpDetail[0]&&grpDetail[0].name)||groupId;
        const destIata=((grpDetail[0]&&grpDetail[0].destination_iata)||'').trim().toUpperCase().slice(0,3);
        writeAuditLog(groupId,myUuid,'member_added',linkedId,{kind:'linked',member_id:memberId});
        writeNotification(linkedId,groupId,'group_invite',{organizer_name:orgName,group_name:grpName,consent_id:consentId});
        const targetEmail=targetEmailRows[0]&&targetEmailRows[0].email;
        if(targetEmail)sendGroupInviteEmail(targetEmail,orgName,grpName,destIata,consentId).catch(function(e){console.warn("group invite email failed:",e.message);});
      }
      members.push({id:memberId,kind,named_only_id:namedId,linked_uuid:linkedId,display_name:memberName,role:'member',avatar_color:color});
      await sql("UPDATE traveler_groups SET members=:m::jsonb,updated_at=NOW() WHERE id=:id",[strParam("m",JSON.stringify(members)),strParam("id",groupId)]);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'trip_group_member_added',:m2::jsonb)",
        [uuidParam("u",myUuid),strParam("m2",JSON.stringify({trip_group_id:groupId,member_kind:kind,member_id:memberId}))]);
      if(kind==='named_only')writeAuditLog(groupId,myUuid,'member_added',null,{kind:'named_only',member_id:memberId,display_name:memberName});
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify({id:memberId,kind,named_only_id:namedId,linked_uuid:linkedId,display_name:memberName,avatar_color:color})};
    }
    // DELETE /api/v1/trip-groups/{group_id}/members/{member_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/members\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],memberId=parts[5];
      await validateTripGroupId(groupId,myUuid);
      const groupRows=await sql("SELECT members FROM traveler_groups WHERE id=:id",[strParam("id",groupId)]);
      const members=typeof groupRows[0].members==="string"?JSON.parse(groupRows[0].members):(groupRows[0].members||[]);
      const before=members.length;
      const removed=members.find(function(m){return m.id===memberId;});
      const updated=members.filter(function(m){return m.id!==memberId;});
      if(updated.length===before)return err("Member not found",event,404);
      await sql("UPDATE traveler_groups SET members=:m::jsonb,updated_at=NOW() WHERE id=:id",[strParam("m",JSON.stringify(updated)),strParam("id",groupId)]);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'trip_group_member_removed',:m2::jsonb)",
        [uuidParam("u",myUuid),strParam("m2",JSON.stringify({trip_group_id:groupId,member_kind:(removed||{}).kind,member_id:memberId}))]);
      writeAuditLog(groupId,myUuid,'member_removed',(removed&&removed.linked_uuid)||null,{member_id:memberId,display_name:(removed&&removed.display_name)||null});
      return ok({success:true},event);
    }
    // ── Named-only Document Routes ─────────────────────────────────────────
    // GET /api/v1/named-only/{id}/documents
    if(method==="GET"&&path.match(/^\/api\/v1\/named-only\/[^/]+\/documents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const namedId=path.split('/').filter(Boolean)[3];
      const own=await sql("SELECT id FROM people_named_only WHERE id=:id AND owner_uuid=:u",[uuidParam("id",namedId),uuidParam("u",myUuid)]);
      if(!own||!own.length)return err("Not found",event,404);
      const docs=await sql("SELECT id,document_type,document_number,issuing_country,surname,given_names,date_of_birth,date_of_issue,date_of_expiry,sex,nationality,notes,created_at FROM named_only_documents WHERE named_only_id=:id ORDER BY created_at DESC",[uuidParam("id",namedId)]);
      return ok(docs,event);
    }
    // POST /api/v1/named-only/{id}/documents
    if(method==="POST"&&path.match(/^\/api\/v1\/named-only\/[^/]+\/documents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const namedId=path.split('/').filter(Boolean)[3];
      const own=await sql("SELECT id FROM people_named_only WHERE id=:id AND owner_uuid=:u",[uuidParam("id",namedId),uuidParam("u",myUuid)]);
      if(!own||!own.length)return err("Not found",event,404);
      const {document_type,document_number,issuing_country,surname,given_names,date_of_birth,date_of_issue,date_of_expiry,sex,nationality,notes}=body;
      if(!document_type||!document_number||!issuing_country||!date_of_expiry)return err("document_type, document_number, issuing_country, date_of_expiry are required",event,400);
      const rows=await sql("INSERT INTO named_only_documents(named_only_id,document_type,document_number,issuing_country,surname,given_names,date_of_birth,date_of_issue,date_of_expiry,sex,nationality,notes) VALUES(:nid,:dtype,:dnum,:country,:sur,:given,:dob,:doi,:doe,:sex,:nat,:notes) RETURNING id,document_type,document_number,issuing_country,date_of_expiry,created_at",
        [uuidParam("nid",namedId),strParam("dtype",document_type),strParam("dnum",document_number),strParam("country",issuing_country.slice(0,3)),strParam("sur",surname||null),strParam("given",given_names||null),dateParam("dob",date_of_birth||null),dateParam("doi",date_of_issue||null),dateParam("doe",date_of_expiry),strParam("sex",sex||null),strParam("nat",nationality||null),strParam("notes",notes||null)]);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'named_only_document_added',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({named_only_id:namedId,document_type}))]);
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify(rows[0])};
    }
    // PATCH /api/v1/named-only/{id}/documents/{doc_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/named-only\/[^/]+\/documents\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const namedId=parts[3],docId=parts[5];
      const own=await sql("SELECT id FROM people_named_only WHERE id=:id AND owner_uuid=:u",[uuidParam("id",namedId),uuidParam("u",myUuid)]);
      if(!own||!own.length)return err("Not found",event,404);
      const {document_number,issuing_country,surname,given_names,date_of_birth,date_of_issue,date_of_expiry,sex,nationality,notes}=body;
      const rows=await sql("UPDATE named_only_documents SET document_number=COALESCE(:dnum,document_number),issuing_country=COALESCE(:country,issuing_country),surname=:sur,given_names=:given,date_of_birth=:dob,date_of_issue=:doi,date_of_expiry=COALESCE(:doe,date_of_expiry),sex=:sex,nationality=:nat,notes=:notes,updated_at=NOW() WHERE id=:docid AND named_only_id=:nid RETURNING id",
        [strParam("dnum",document_number||null),strParam("country",issuing_country?issuing_country.slice(0,3):null),strParam("sur",surname||null),strParam("given",given_names||null),dateParam("dob",date_of_birth||null),dateParam("doi",date_of_issue||null),dateParam("doe",date_of_expiry||null),strParam("sex",sex||null),strParam("nat",nationality||null),strParam("notes",notes||null),uuidParam("docid",docId),uuidParam("nid",namedId)]);
      if(!rows||!rows.length)return err("Document not found",event,404);
      return ok({success:true},event);
    }
    // DELETE /api/v1/named-only/{id}/documents/{doc_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/named-only\/[^/]+\/documents\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const namedId=parts[3],docId=parts[5];
      const own=await sql("SELECT id FROM people_named_only WHERE id=:id AND owner_uuid=:u",[uuidParam("id",namedId),uuidParam("u",myUuid)]);
      if(!own||!own.length)return err("Not found",event,404);
      await sql("DELETE FROM named_only_documents WHERE id=:docid AND named_only_id=:nid",[uuidParam("docid",docId),uuidParam("nid",namedId)]);
      return ok({success:true},event);
    }
    // ── Trip Group Consent Routes ──────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/consents
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/consents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      const consents=await sql("SELECT id,target_uuid,status,requested_scopes,granted_scopes,message,requested_at,responded_at FROM trip_group_consents WHERE trip_group_id=:id ORDER BY requested_at DESC",[strParam("id",groupId)]);
      return ok(consents.map(function(c){try{return Object.assign({},c,{requested_scopes:typeof c.requested_scopes==='string'?JSON.parse(c.requested_scopes):(c.requested_scopes||[]),granted_scopes:typeof c.granted_scopes==='string'?JSON.parse(c.granted_scopes):(c.granted_scopes||null)});}catch(e){return c;}}),event);
    }
    // POST /api/v1/trip-groups/{group_id}/consents
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/consents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      const {target_uuid,requested_scopes,message}=body;
      if(!target_uuid)return err("target_uuid required",event,400);
      const scopes=Array.isArray(requested_scopes)&&requested_scopes.length?requested_scopes:["passport"];
      const rows=await sql("INSERT INTO trip_group_consents(trip_group_id,requester_uuid,target_uuid,status,requested_scopes,message) VALUES(:gid,:u,:tgt,'pending',:scopes::jsonb,:msg) RETURNING id",
        [strParam("gid",groupId),uuidParam("u",myUuid),uuidParam("tgt",target_uuid),strParam("scopes",JSON.stringify(scopes)),strParam("msg",message||null)]);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'trip_group_consent_requested',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({trip_group_id:groupId,target_uuid,scopes}))]);
      writeAuditLog(groupId,myUuid,'consent_requested',target_uuid,{scopes});
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify({id:rows[0].id,status:'pending'})};
    }
    // DELETE /api/v1/trip-groups/{group_id}/consents/{consent_id} — withdraw
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/consents\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],consentId=parts[5];
      await validateTripGroupId(groupId,myUuid);
      const rows=await sql("UPDATE trip_group_consents SET status='withdrawn',responded_at=NOW() WHERE id=:cid AND trip_group_id=:gid AND requester_uuid=:u AND status='pending' RETURNING id",
        [uuidParam("cid",consentId),strParam("gid",groupId),uuidParam("u",myUuid)]);
      if(!rows||!rows.length)return err("Consent not found or already resolved",event,404);
      await sql("INSERT INTO auth_security_events(traveler_uuid,event_type,metadata) VALUES(:u,'trip_group_consent_withdrawn',:m::jsonb)",
        [uuidParam("u",myUuid),strParam("m",JSON.stringify({trip_group_id:groupId,consent_id:consentId}))]);
      return ok({success:true},event);
    }
    // ── Readiness Route ────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/readiness
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/readiness$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const groupRows=await sql("SELECT tg.*,t.destination_iata,t.return_date FROM traveler_groups tg LEFT JOIN trips t ON t.id=tg.trip_id WHERE tg.id=:id",[strParam("id",groupId)]);
      const g=groupRows[0];
      const destIata=(g.destination_iata||g.destination||'').trim().toUpperCase().slice(0,3);
      const returnDate=g.return_date||null;
      const members=typeof g.members==="string"?JSON.parse(g.members):(g.members||[]);
      // Fetch docs for self (organizer's own docs, or member's own docs)
      const selfDocs=await sql("SELECT doc_type AS document_type,expiry_date AS date_of_expiry FROM travel_documents WHERE traveler_uuid=:u AND doc_type='PASSPORT'",[uuidParam("u",myUuid)]);
      // Named-only docs — only organizer can access these
      const namedIds=role==='organizer'?members.filter(function(m){return m.kind==='named_only'&&m.named_only_id;}).map(function(m){return m.named_only_id;}):[];
      const namedDocs=namedIds.length?await sql("SELECT named_only_id::text,document_type,date_of_expiry FROM named_only_documents WHERE named_only_id=ANY(ARRAY["+namedIds.map(function(_,i){return':id'+i;}).join(',')+"]::uuid[])",namedIds.map(function(id,i){return uuidParam('id'+i,id);})):[];
      const namedDocMap={};
      namedDocs.forEach(function(d){if(!namedDocMap[d.named_only_id])namedDocMap[d.named_only_id]=[];namedDocMap[d.named_only_id].push(d);});
      const consents=await sql("SELECT target_uuid::text,status FROM trip_group_consents WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const consentMap={};consents.forEach(function(c){consentMap[c.target_uuid]=c.status;});
      const memberResults=members.map(function(m){
        const isSelf=(m.kind==='self'&&role==='organizer')||(m.kind==='linked'&&m.linked_uuid===myUuid);
        let docs=[],displayName=m.display_name||'Member';
        if(m.kind==='self')docs=selfDocs;
        else if(m.kind==='named_only'){
          if(role==='organizer')docs=namedDocMap[m.named_only_id]||[];
          else return{member_id:m.id,kind:m.kind,display_name:displayName,avatar_color:m.avatar_color,joined:true};
        }
        else if(m.kind==='linked'){
          const cStatus=consentMap[m.linked_uuid];
          if(m.linked_uuid===myUuid){
            // This is the calling member — show their own data
            docs=selfDocs;
          } else if(role==='organizer'){
            if(cStatus!=='approved'){
              return{member_id:m.id,kind:m.kind,display_name:displayName,avatar_color:m.avatar_color,checks:[{id:'consent_pending',label:'Data sharing',status:cStatus==='pending'?'pending':'failed',detail:cStatus==='pending'?'Sharing request sent — waiting for approval':'No sharing request sent'}],overall_status:'action_needed'};
            }
            // approved linked member — organizer can't see their actual docs (tier 2 restriction)
            return{member_id:m.id,kind:m.kind,display_name:displayName,avatar_color:m.avatar_color,checks:[{id:'consent_approved',label:'Data sharing',status:'passed',detail:'Member approved data sharing'}],overall_status:'ready',consent_status:'approved'};
          } else {
            // Joined member viewing another member — stub only
            return{member_id:m.id,kind:m.kind,display_name:displayName,avatar_color:m.avatar_color,joined:cStatus==='approved'};
          }
        }
        const admissibility=evaluateAdmissibility(docs,destIata,returnDate);
        const passportCheck={id:'passport_present',label:'Passport',status:docs.length?'passed':'failed',detail:docs.length?'On file':'Not added'};
        return{member_id:m.id,kind:m.kind,display_name:displayName,avatar_color:m.avatar_color,checks:[passportCheck,...admissibility.checks],overall_status:docs.length?admissibility.overall_status:'action_needed'};
      });
      const total=memberResults.length;
      const ready=memberResults.filter(function(m){return m.overall_status==='ready';}).length;
      const action=memberResults.filter(function(m){return m.overall_status==='action_needed';}).length;
      const blocked=memberResults.filter(function(m){return m.overall_status==='blocked';}).length;
      const resp={trip_group_id:groupId,destination:destIata,destination_name:(RULES[destIata]||{}).name||destIata,return_date:returnDate,role};
      if(role==='organizer'){
        resp.members=memberResults;
        resp.summary={total,ready,action_needed:action,blocked};
        resp.rule_source='hardcoded_v1';
        resp.disclaimer=RULES._meta.disclaimer;
      } else {
        // Member view — own full data + aggregate summary + stub list
        const ownFull=memberResults.find(function(m){return m.kind==='linked'&&m.checks;});
        resp.my_readiness=ownFull||null;
        resp.members=memberResults;
        resp.aggregate_summary={total,ready,action_needed:action,blocked};
        resp.rule_source='hardcoded_v1';
        resp.disclaimer=RULES._meta.disclaimer;
      }
      return ok(resp,event);
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
      const {email:inviteEmail,message:inviteMsg,target_uuid:directTargetUuid}=body;
      let targetUuid=null;
      let resolvedEmail=null;
      if(directTargetUuid){
        // UUID-direct path: Find-on-UniProfile search flow
        if(directTargetUuid===myUuid)return err("Cannot invite yourself",event,400);
        const targetRows=await sql("SELECT uuid,email FROM travelers WHERE uuid=:t",[uuidParam("t",directTargetUuid)]);
        if(!targetRows.length)return err("Target account not found",event,404);
        targetUuid=directTargetUuid;
        resolvedEmail=targetRows[0].email||null;
      } else if(inviteEmail){
        // Email path: manual email invite flow
        if(inviteEmail.toLowerCase()===token.email.toLowerCase())return err("Cannot invite yourself",event,400);
        const targetRows=await sql("SELECT uuid FROM travelers WHERE email=:e",[strParam("e",inviteEmail)]);
        targetUuid=targetRows[0]&&targetRows[0].uuid||null;
        resolvedEmail=inviteEmail;
      } else {
        return err("Email or target_uuid required",event,400);
      }
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
        [uuidParam("r",myUuid),targetUuid?uuidParam("t",targetUuid):{name:"t",value:{isNull:true}},strParam("e",resolvedEmail||null),strParam("msg",inviteMsg||null)]);
      // Get inviter name for email notification
      const inviterRows=await sql("SELECT legal_first,legal_last,email FROM travelers t LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE t.uuid=:u",[uuidParam("u",myUuid)]);
      const inviter=inviterRows[0]||{};
      const inviterName=[inviter.legal_first,inviter.legal_last].filter(Boolean).join(" ")||inviter.email||"A UniProfile member";
      if(resolvedEmail)sendInviteEmail(resolvedEmail,inviterName,inviteMsg||"",invite[0].id).catch(e=>console.error("SES send failed:",e.message));
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
      if(!validateUpId(upid))return err("That UniProfile ID doesn't look right — please check it.",event,400);
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
    if(method==="POST"&&path.match(/\/profile\/[^/]+\/reissue-up-id$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      let newId=generateUpId();
      for(let retry=0;retry<5;retry++){
        const clash=await sql("SELECT 1 FROM travelers WHERE uniprofile_number=:id",[strParam("id",newId)]);
        if(!clash.length)break;
        newId=generateUpId();
        if(retry===4)return err("ID generation failed — please try again",event,500);
      }
      await sql("UPDATE travelers SET uniprofile_number=:id WHERE uuid=:u",[strParam("id",newId),uuidParam("u",uuid)]);
      return ok({success:true,uniprofile_number:newId},event);
    }
    // ── Groups v2 (GCUUID architecture) ──────────────────────────────────────
    // Generate a GCUUID
    function generateGcuuid(){
      const {randomBytes}=require('crypto');
      const chars='23456789ABCDEFGHJKMNPQRSTVWXYZ';
      let s='GC-';
      for(let i=0;i<4;i++)s+=chars[randomBytes(1)[0]%chars.length];
      s+='-';
      for(let i=0;i<4;i++)s+=chars[randomBytes(1)[0]%chars.length];
      return s;
    }
    function generateGroupId(){
      const {randomBytes}=require('crypto');
      const chars='ABCDEFGHJKMNPQRSTVWXYZ23456789';
      let s='GRP-';
      for(let i=0;i<8;i++)s+=chars[randomBytes(1)[0]%chars.length];
      return s;
    }
    function generateParcelNumber(){
      const {randomBytes}=require('crypto');
      const chars='23456789ABCDEFGHJKMNPQRSTVWXYZ';
      let s='UP-PARCEL-';
      for(let i=0;i<4;i++)s+=chars[randomBytes(1)[0]%chars.length];
      s+='-';
      for(let i=0;i<4;i++)s+=chars[randomBytes(1)[0]%chars.length];
      return s;
    }

    // GET /api/v1/gcgroups/{uuid} — list groups for traveler
    if(method==="GET"&&path.match(/\/api\/v1\/gcgroups\/[^/]+$/)&&!path.includes("/members")&&!path.includes("/parcels")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      // Groups where user is owner or active member
      const groups=await sql(`SELECT DISTINCT g.id,g.gcuuid,g.name,g.inferred_type,g.status,g.created_at,
        (SELECT COUNT(*) FROM gc_group_members gm2 WHERE gm2.group_id=g.id AND gm2.status='active') as member_count
        FROM gc_groups g
        LEFT JOIN gc_group_members gm ON gm.group_id=g.id AND gm.traveler_uuid=:u AND gm.status='active'
        WHERE g.owner_uuid=:u OR gm.traveler_uuid=:u
        ORDER BY g.created_at DESC`,[uuidParam("u",myUuid)]);
      // For each group, get members
      const result=[];
      for(const g of groups){
        const members=await sql(`SELECT gm.id,gm.invited_name,gm.relationship,gm.role,gm.management,gm.status,gm.age,gm.traveler_uuid,gm.invited_email,
          t.uniprofile_number,t.display_name,ti.legal_first FROM gc_group_members gm
          LEFT JOIN travelers t ON t.uuid=gm.traveler_uuid
          LEFT JOIN traveler_identity ti ON ti.traveler_uuid=gm.traveler_uuid
          WHERE gm.group_id=:gid AND gm.status='active' ORDER BY gm.created_at ASC`,[strParam("gid",g.id)]);
        // latest parcel
        const parcels=await sql(`SELECT id,destination,dep_date,ret_date,status,parcel_number FROM gc_trip_parcels WHERE group_id=:gid ORDER BY created_at DESC LIMIT 1`,[strParam("gid",g.id)]);
        result.push({...g,members,latest_parcel:parcels[0]||null});
      }
      return ok({groups:result},event);
    }

    // POST /api/v1/gcgroups/{uuid} — create group
    if(method==="POST"&&path.match(/\/api\/v1\/gcgroups\/[^/]+$/)&&!path.includes("/members")&&!path.includes("/parcels")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      if(myUuid!==uuid)return err("Access denied",event,403);
      const {name,inferred_type,initial_members}=body;
      if(!name||!name.trim())return err("name required",event,400);
      const gid=generateGroupId();
      const gcuuid=generateGcuuid();
      await sql(`INSERT INTO gc_groups (id,gcuuid,owner_uuid,name,inferred_type) VALUES (:id,:gcuuid,:u,:name,:type)`,
        [strParam("id",gid),strParam("gcuuid",gcuuid),uuidParam("u",myUuid),strParam("name",name.trim()),strParam("type",inferred_type||"travel_group")]);
      // Add creator as first member
      const creatorInfo=await sql("SELECT legal_first,legal_last FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",myUuid)]);
      const creatorName=creatorInfo[0]?(creatorInfo[0].legal_first||"")+" "+(creatorInfo[0].legal_last||""):"You";
      await sql(`INSERT INTO gc_group_members (group_id,traveler_uuid,invited_name,relationship,role,management,status,joined_at) VALUES (:gid,:u,:name,'self','primary','self','active',NOW())`,
        [strParam("gid",gid),uuidParam("u",myUuid),strParam("name",creatorName.trim()||"You")]);
      // Add initial members
      for(const m of (initial_members||[])){
        await sql(`INSERT INTO gc_group_members (group_id,traveler_uuid,invited_email,invited_name,relationship,role,management,age,status) VALUES (:gid,:tuuid,:email,:name,:rel,'member',:mgmt,:age,'active')`,
          [strParam("gid",gid),m.traveler_uuid?{name:"tuuid",value:{stringValue:m.traveler_uuid},typeHint:"UUID"}:{name:"tuuid",value:{isNull:true}},
           strParam("email",m.email),strParam("name",m.name||"Member"),strParam("rel",m.relationship||"companion"),
           strParam("mgmt",(m.age&&m.age<16)?"managed":"self"),numParam("age",m.age||null)]);
      }
      return ok({success:true,group_id:gid,gcuuid},event,201);
    }

    // GET /api/v1/gcgroups/{uuid}/{groupId} — get group detail
    if(method==="GET"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+$/)&&!path.includes("/members/")&&!path.includes("/parcels")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.length-1];
      // verify access
      const access=await sql(`SELECT 1 FROM gc_groups g LEFT JOIN gc_group_members gm ON gm.group_id=g.id AND gm.traveler_uuid=:u AND gm.status='active'
        WHERE g.id=:gid AND (g.owner_uuid=:u OR gm.traveler_uuid=:u)`,[uuidParam("u",myUuid),strParam("gid",groupId)]);
      if(!access.length)return err("Not found or access denied",event,404);
      const g=(await sql("SELECT * FROM gc_groups WHERE id=:gid",[strParam("gid",groupId)]))[0];
      const members=await sql(`SELECT gm.*,t.uniprofile_number,t.display_name,ti.legal_first FROM gc_group_members gm LEFT JOIN travelers t ON t.uuid=gm.traveler_uuid LEFT JOIN traveler_identity ti ON ti.traveler_uuid=gm.traveler_uuid WHERE gm.group_id=:gid AND gm.status='active' ORDER BY gm.created_at ASC`,[strParam("gid",groupId)]);
      const parcels=await sql("SELECT * FROM gc_trip_parcels WHERE group_id=:gid ORDER BY created_at DESC",[strParam("gid",groupId)]);
      const consents=await sql("SELECT * FROM gc_consent_grants WHERE group_id=:gid ORDER BY granted_at DESC LIMIT 20",[strParam("gid",groupId)]);
      // doc matrix: owner sees all members; non-owners see their own row only
      const docMatrix=[];
      for(const m of members){
        if(!m.traveler_uuid)continue;
        if(myUuid!==g.owner_uuid&&m.traveler_uuid!==myUuid)continue;
        const docs=await sql(`SELECT doc_type,expiry_date,days_remaining FROM travel_documents WHERE traveler_uuid=:u ORDER BY is_primary DESC`,[uuidParam("u",m.traveler_uuid)]);
        docMatrix.push({member_id:m.id,member_name:(m.display_name&&m.display_name.trim())||(m.legal_first&&m.legal_first.trim())||m.invited_name||'Member',docs});
      }
      return ok({group:g,members,parcels,consents,doc_matrix:docMatrix},event);
    }

    // POST /api/v1/gcgroups/{uuid}/{groupId}/members — add member
    if(method==="POST"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/members$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.indexOf("members")-1];
      const own=await sql("SELECT 1 FROM gc_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      if(!own.length)return err("Only group owner can add members",event,403);
      const {name,email,relationship,age,up_id}=body;
      if(!name||!name.trim())return err("name required",event,400);
      // Try to resolve traveler_uuid from UP id or email
      let targetUuid=null;
      if(up_id&&validateUpId(up_id)){
        const found=await sql("SELECT uuid FROM travelers WHERE uniprofile_number=:id",[strParam("id",up_id)]);
        if(found.length)targetUuid=found[0].uuid;
      }
      if(!targetUuid&&email){
        const found=await sql("SELECT uuid FROM travelers WHERE LOWER(email)=LOWER(:e)",[strParam("e",email)]);
        if(found.length)targetUuid=found[0].uuid;
      }
      const management=(age&&age<16)?"managed":"self";
      const rows=await sql(`INSERT INTO gc_group_members (group_id,traveler_uuid,invited_email,invited_name,relationship,role,management,age,status,joined_at)
        VALUES (:gid,:tuuid,:email,:name,:rel,'member',:mgmt,:age,'active',CASE WHEN :tuuid IS NOT NULL THEN NOW() ELSE NULL END) RETURNING id`,
        [strParam("gid",groupId),targetUuid?uuidParam("tuuid",targetUuid):{name:"tuuid",value:{isNull:true}},
         strParam("email",email),strParam("name",name.trim()),strParam("rel",relationship||"companion"),strParam("mgmt",management),numParam("age",age||null)]);
      return ok({success:true,member_id:rows[0].id},event,201);
    }

    // DELETE /api/v1/gcgroups/{uuid}/{groupId}/members/{memberId} — remove member
    if(method==="DELETE"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/members\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const memberId=parts[parts.length-1];const groupId=parts[parts.indexOf("members")-1];
      const own=await sql("SELECT 1 FROM gc_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      if(!own.length)return err("Only group owner can remove members",event,403);
      await sql("UPDATE gc_group_members SET status='removed' WHERE id=:mid AND group_id=:gid",[uuidParam("mid",memberId),strParam("gid",groupId)]);
      return ok({success:true},event);
    }

    // POST /api/v1/gcgroups/{uuid}/{groupId}/parcels — create parcel + run pre-flight checks
    if(method==="POST"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/parcels$/)&&!path.includes("/parcels/")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.indexOf("parcels")-1];
      const access=await sql(`SELECT 1 FROM gc_groups g LEFT JOIN gc_group_members gm ON gm.group_id=g.id AND gm.traveler_uuid=:u AND gm.status='active'
        WHERE g.id=:gid AND (g.owner_uuid=:u OR gm.traveler_uuid=:u)`,[uuidParam("u",myUuid),strParam("gid",groupId)]);
      if(!access.length)return err("Access denied",event,403);
      const {destination,dep_date,ret_date,member_ids}=body;
      if(!destination||!dep_date)return err("destination and dep_date required",event,400);
      const parcelNum=generateParcelNumber();
      const rows=await sql(`INSERT INTO gc_trip_parcels (group_id,creator_uuid,destination,dep_date,ret_date,member_ids,parcel_number) VALUES (:gid,:u,:dest,:dep,:ret,:mids::jsonb,:pnum) RETURNING id`,
        [strParam("gid",groupId),uuidParam("u",myUuid),strParam("dest",destination),
         dateParam("dep",dep_date),dateParam("ret",ret_date||dep_date),
         strParam("mids",JSON.stringify(member_ids||[])),strParam("pnum",parcelNum)]);
      const parcelId=rows[0].id;
      // Run 8 pre-flight checks
      const selectedMemberIds=member_ids||[];
      const members=selectedMemberIds.length>0
        ? await sql(`SELECT gm.id,gm.invited_name,gm.traveler_uuid,gm.age,t.display_name,ti.legal_first FROM gc_group_members gm LEFT JOIN travelers t ON t.uuid=gm.traveler_uuid LEFT JOIN traveler_identity ti ON ti.traveler_uuid=gm.traveler_uuid WHERE gm.group_id=:gid AND gm.status='active' AND gm.id::text=ANY(:mids::text[])`,
            [strParam("gid",groupId),strParam("mids","{"+selectedMemberIds.join(",")+"}")])
        : await sql(`SELECT gm.id,gm.invited_name,gm.traveler_uuid,gm.age,t.display_name,ti.legal_first FROM gc_group_members gm LEFT JOIN travelers t ON t.uuid=gm.traveler_uuid LEFT JOIN traveler_identity ti ON ti.traveler_uuid=gm.traveler_uuid WHERE gm.group_id=:gid AND gm.status='active'`,[strParam("gid",groupId)]);
      // Use display_name > legal_first > invited_name for human-facing check copy
      members.forEach(m=>{m._displayName=(m.display_name&&m.display_name.trim())||(m.legal_first&&m.legal_first.trim())||m.invited_name||'Member';});
      const retDateObj=ret_date?new Date(ret_date):new Date(dep_date);
      const depDateObj=new Date(dep_date);
      const today=new Date();
      const daysUntilDep=Math.ceil((depDateObj-today)/(1000*60*60*24));
      const sixMonthsFromRet=new Date(retDateObj);sixMonthsFromRet.setMonth(sixMonthsFromRet.getMonth()+6);
      const checks=[];
      for(const m of members){
        if(!m.traveler_uuid)continue;
        // Check 1: Passport validity
        const docs=await sql(`SELECT doc_type,expiry_date,doc_number FROM travel_documents WHERE traveler_uuid=:u AND doc_type IN ('passport','PASSPORT') ORDER BY is_primary DESC LIMIT 1`,[uuidParam("u",m.traveler_uuid)]);
        if(docs.length){
          const exp=new Date(docs[0].expiry_date);
          let status='pass',headline='',detail='';
          if(exp<today){status=daysUntilDep<=14?'critical':'blocker';headline=m._displayName+"'s passport is expired";detail="Expired "+exp.toLocaleDateString();}
          else if(exp<sixMonthsFromRet){status=daysUntilDep<=14?'critical':'blocker';headline=m._displayName+"'s passport expires before the 6-month threshold";detail="Expires "+exp.toLocaleDateString()+". Most destinations require 6 months validity beyond return date.";}
          else{headline=m._displayName+"'s passport is valid";detail="Expires "+exp.toLocaleDateString()+"."}
          checks.push({parcel_id:parcelId,check_type:'passport_validity',member_id:m.traveler_uuid,member_name:m._displayName,status,headline,detail});
        } else {
          checks.push({parcel_id:parcelId,check_type:'passport_validity',member_id:m.traveler_uuid,member_name:m._displayName,status:'unknown',headline:m._displayName+"'s passport — not on file",detail:"Add passport details to run this check."});
        }
        // Check 4: KTN/Global Entry
        const ktn=await sql("SELECT ktn FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",m.traveler_uuid)]);
        const hasKtn=ktn.length&&ktn[0].ktn;
        checks.push({parcel_id:parcelId,check_type:'ktn_global_entry',member_id:m.traveler_uuid,member_name:m._displayName,
          status:hasKtn?'pass':'tradeoff',headline:hasKtn?m._displayName+" has KTN / Global Entry":m._displayName+" — no KTN or Global Entry on file",
          detail:hasKtn?"Pre-check enrolled.":"Consider enrolling before travel to save time at security."});
        // Check 7: Meal/dietary
        const meal=await sql("SELECT meal_code FROM meal_preferences WHERE traveler_uuid=:u LIMIT 1",[uuidParam("u",m.traveler_uuid)]);
        checks.push({parcel_id:parcelId,check_type:'meal_dietary',member_id:m.traveler_uuid,member_name:m._displayName,
          status:'pass',headline:meal.length?m._displayName+"'s meal preference: "+(meal[0].meal_code||"standard"):m._displayName+" — no meal preference set",
          detail:meal.length?"Captured and ready for booking SSR.":"No dietary restriction recorded — standard meal assumed."});
        // Check 8: Travel name match (doc name vs identity)
        const identity=await sql("SELECT legal_first,legal_last FROM traveler_identity WHERE traveler_uuid=:u",[uuidParam("u",m.traveler_uuid)]);
        const passDoc=await sql("SELECT given_names,surname FROM travel_documents WHERE traveler_uuid=:u AND doc_type IN ('passport','PASSPORT') ORDER BY is_primary DESC LIMIT 1",[uuidParam("u",m.traveler_uuid)]);
        if(identity.length&&passDoc.length){
          const iFirst=(identity[0].legal_first||"").toLowerCase().trim();
          const iLast=(identity[0].legal_last||"").toLowerCase().trim();
          const dFirst=(passDoc[0].given_names||"").toLowerCase().trim();
          const dLast=(passDoc[0].surname||"").toLowerCase().trim();
          const match=iFirst&&iLast&&dFirst&&dLast&&(iLast===dLast||dLast.includes(iLast)||iLast.includes(dLast));
          checks.push({parcel_id:parcelId,check_type:'travel_name_match',member_id:m.traveler_uuid,member_name:m._displayName,
            status:match?'pass':'tradeoff',headline:match?m._displayName+"'s name matches passport":m._displayName+" — name mismatch, verify before booking",
            detail:match?"Identity and passport names are consistent.":"Check that the booking name exactly matches the passport."});
        }
      }
      // Checks 2,3,5,6 — Visa, Vaccinations, Accessibility, Insurance: stub as 'unknown' (Timatic/live API — Phase 2)
      const stubChecks=[
        {type:'visa_eligibility',headline:'Visa eligibility — not yet verified',detail:'Real-time visa check (Timatic) is Phase 2. Verify manually before booking.'},
        {type:'vaccinations',headline:'Vaccination requirements — not yet verified',detail:'Check destination health authority for current requirements.'},
        {type:'accessibility_match',headline:'Accessibility alignment — not yet verified',detail:'Carrier accessibility ratings coming in Phase 2.'},
        {type:'insurance_coverage',headline:'Insurance coverage — not yet verified',detail:'Add insurance policies in the Insurance & Tours module to enable this check.'},
      ];
      for(const sc of stubChecks){
        checks.push({parcel_id:parcelId,check_type:sc.type,member_id:null,member_name:null,status:'unknown',headline:sc.headline,detail:sc.detail});
      }
      // Insert all checks
      for(const c of checks){
        await sql(`INSERT INTO gc_parcel_checks (parcel_id,check_type,member_id,member_name,status,headline,detail) VALUES (:pid,:ct,:mid,:mn,:st,:hl,:dt)`,
          [uuidParam("pid",c.parcel_id),strParam("ct",c.check_type),
           c.member_id?uuidParam("mid",c.member_id):{name:"mid",value:{isNull:true}},
           strParam("mn",c.member_name),strParam("st",c.status),strParam("hl",c.headline),strParam("dt",c.detail)]);
      }
      return ok({success:true,parcel_id:parcelId,parcel_number:parcelNum,checks},event,201);
    }

    // GET /api/v1/gcgroups/{uuid}/{groupId}/parcels/{parcelId} — get parcel with checks
    if(method==="GET"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/parcels\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const parcelId=parts[parts.length-1];const groupId=parts[parts.length-3];
      const access=await sql(
        `SELECT p.id FROM gc_trip_parcels p JOIN gc_groups g ON g.id=p.group_id LEFT JOIN gc_group_members gm ON gm.group_id=g.id AND gm.traveler_uuid=:u AND gm.status='active' WHERE p.id=:pid AND p.group_id=:gid AND (g.owner_uuid=:u OR gm.traveler_uuid=:u)`,
        [uuidParam("u",myUuid),uuidParam("pid",parcelId),strParam("gid",groupId)]
      );
      if(!access.length)return err("Access denied",event,403);
      const parcel=(await sql("SELECT * FROM gc_trip_parcels WHERE id=:pid",[uuidParam("pid",parcelId)]))[0];
      const checks=await sql("SELECT * FROM gc_parcel_checks WHERE parcel_id=:pid ORDER BY check_type,member_name",[uuidParam("pid",parcelId)]);
      return ok({parcel,checks},event);
    }

    // PUT /api/v1/gcgroups/{uuid}/{groupId}/parcels/{parcelId}/resolve — mark a check resolved
    if(method==="PUT"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/parcels\/[^/]+\/resolve$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.length-4];const parcelId=parts[parts.length-2];
      const {check_id,resolution}=body;
      if(!check_id)return err("check_id required",event,400);
      const access=await sql(
        `SELECT 1 FROM gc_parcel_checks pc JOIN gc_trip_parcels p ON p.id=pc.parcel_id JOIN gc_groups g ON g.id=p.group_id LEFT JOIN gc_group_members gm ON gm.group_id=g.id AND gm.traveler_uuid=:u AND gm.status='active' WHERE pc.id=:cid AND pc.parcel_id=:pid::uuid AND p.group_id=:gid AND (g.owner_uuid=:u OR gm.traveler_uuid=:u)`,
        [uuidParam("u",myUuid),uuidParam("cid",check_id),uuidParam("pid",parcelId),strParam("gid",groupId)]
      );
      if(!access.length)return err("Access denied",event,403);
      await sql("UPDATE gc_parcel_checks SET status='resolved',resolution=:res,resolved_at=NOW() WHERE id=:cid",[strParam("res",resolution||"acknowledged"),uuidParam("cid",check_id)]);
      return ok({success:true},event);
    }

    // POST /api/v1/gcgroups/{uuid}/{groupId}/consent — log consent grant
    if(method==="POST"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+\/consent$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.indexOf("consent")-1];
      const {operator,scope_tokens,purpose,parcel_id}=body;
      if(!operator)return err("operator required",event,400);
      const expires=new Date();expires.setHours(expires.getHours()+24);
      await sql(`INSERT INTO gc_consent_grants (group_id,member_uuid,operator,scope_tokens,purpose,granted_by,expires_at,parcel_id) VALUES (:gid,:u,:op,:sc::jsonb,:pur,:gb,:exp,:pid)`,
        [strParam("gid",parts[parts.indexOf("consent")-1]),uuidParam("u",myUuid),strParam("op",operator),
         strParam("sc",JSON.stringify(scope_tokens||[])),strParam("pur",purpose),uuidParam("gb",myUuid),
         strParam("exp",expires.toISOString()),parcel_id?uuidParam("pid",parcel_id):{name:"pid",value:{isNull:true}}]);
      return ok({success:true},event);
    }

    // DELETE /api/v1/gcgroups/{uuid}/{groupId} — delete group
    if(method==="DELETE"&&path.match(/\/api\/v1\/gcgroups\/[^/]+\/GRP-[^/]+$/)&&!path.includes("/members")&&!path.includes("/parcels")){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split("/");const groupId=parts[parts.length-1];
      const own=await sql("SELECT 1 FROM gc_groups WHERE id=:gid AND owner_uuid=:u",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      if(!own.length)return err("Only group owner can delete",event,403);
      await sql("DELETE FROM gc_groups WHERE id=:gid",[strParam("gid",groupId)]);
      return ok({success:true},event);
    }
    // ── End Groups v2 ────────────────────────────────────────────────────────

    // PUT /api/v1/profile/{uuid}/display-name — save display name
    if(method==="PUT"&&path.match(/^\/api\/v1\/profile\/[^/]+\/display-name$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      let {display_name}=body;
      if(display_name!==null&&display_name!==undefined){
        display_name=String(display_name).trim().replace(/[ -​-‏﻿]/g,"");
        if(display_name.length===0)display_name=null;
        else if(display_name.length>40)return err("Display name must be 40 characters or fewer",event,400);
        else if(/^UP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(display_name))return err("Display name cannot match a UniProfile ID format",event,400);
      }
      await sql("UPDATE travelers SET display_name=:dn WHERE uuid=:u",[strParam("dn",display_name),uuidParam("u",myUuid)]);
      await logSecEvent(myUuid,"display_name_changed",{},event);
      const prof=await buildProfile(myUuid);
      return ok({success:true,profile:prof},event);
    }

    // ── Auth Security ─────────────────────────────────────────────────────────
    // Pure Node.js TOTP (RFC 6238) — no external deps
    const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    function b32enc(buf){let b=0,v=0,o='';for(let i=0;i<buf.length;i++){v=(v<<8)|buf[i];b+=8;while(b>=5){o+=B32[(v>>>(b-5))&31];b-=5;}}if(b>0)o+=B32[(v<<(5-b))&31];while(o.length%8)o+='=';return o;}
    function b32dec(s){s=s.replace(/=+$/,'').toUpperCase();const buf=[];let b=0,v=0;for(let i=0;i<s.length;i++){const idx=B32.indexOf(s[i]);if(idx<0)continue;v=(v<<5)|idx;b+=5;if(b>=8){buf.push((v>>>(b-8))&255);b-=8;}}return Buffer.from(buf);}
    function totpCode(secret32,t){const{createHmac}=require('crypto');const c=Math.floor((t||Date.now()/1000)/30);const cb=Buffer.alloc(8);let x=c;for(let i=7;i>=0;i--){cb[i]=x&0xff;x=Math.floor(x/256);}const h=createHmac('sha1',b32dec(secret32)).update(cb).digest();const off=h[19]&0xf;const code=((h[off]&0x7f)<<24)|(h[off+1]<<16)|(h[off+2]<<8)|h[off+3];return String(code%1000000).padStart(6,'0');}
    function totpVerify(secret32,code){const t=Math.floor(Date.now()/1000);for(let d=-1;d<=1;d++){if(totpCode(secret32,t+d*30)===String(code))return true;}return false;}
    const RC_ABC='23456789abcdefghjkmnpqrstvwxyz';
    function genRecoveryCode(){const{randomBytes}=require('crypto');const c=[];for(let i=0;i<12;i++)c.push(RC_ABC[randomBytes(1)[0]%RC_ABC.length]);return c.slice(0,4).join('')+'-'+c.slice(4,8).join('')+'-'+c.slice(8,12).join('');}
    function hashCode(s){const{createHash}=require('crypto');return createHash('sha256').update('up:'+s.replace(/-/g,'').toLowerCase()).digest('hex');}
    function genStepUpToken(){const{randomBytes}=require('crypto');return randomBytes(32).toString('hex');}
    async function logSecEvent(uuid,type,meta,event){try{await sql("INSERT INTO auth_security_events (traveler_uuid,event_type,ip_address,user_agent,metadata) VALUES (:u,:t,:ip,:ua,:meta::jsonb)",[uuidParam("u",uuid),strParam("t",type),strParam("ip",(event.headers&&(event.headers['x-forwarded-for']||event.headers['X-Forwarded-For']))||null),strParam("ua",(event.headers&&(event.headers['user-agent']||event.headers['User-Agent']))||null),strParam("meta",JSON.stringify(meta||{}))]);}catch(e){console.error("logSecEvent fail:",e.message);}}

    // GET /api/v1/auth/factors
    if(method==="GET"&&path==="/api/v1/auth/factors"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const factors=await sql("SELECT id,factor_type,is_active,label,totp_pending,phone_e164,created_at,updated_at FROM user_security_factors WHERE traveler_uuid=:u ORDER BY created_at",[uuidParam("u",uuid)]);
      const rcCount=await sql("SELECT COUNT(*) as cnt FROM user_recovery_codes WHERE traveler_uuid=:u AND used_at IS NULL",[uuidParam("u",uuid)]);
      return ok({factors,recovery_codes_remaining:parseInt(rcCount[0]&&rcCount[0].cnt)||0},event);
    }

    // POST /api/v1/auth/totp/enroll — generate pending TOTP secret
    if(method==="POST"&&path==="/api/v1/auth/totp/enroll"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const email=token.email||"user";
      // Remove any existing pending TOTP
      await sql("DELETE FROM user_security_factors WHERE traveler_uuid=:u AND factor_type='totp' AND totp_pending=TRUE",[uuidParam("u",uuid)]);
      const {randomBytes}=require('crypto');
      const secret=b32enc(randomBytes(20));
      const label=encodeURIComponent(`UniProfile (${email})`);
      const issuer=encodeURIComponent("UniProfile");
      const otpauth=`otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
      await sql("INSERT INTO user_security_factors (traveler_uuid,factor_type,is_active,label,totp_secret,totp_pending) VALUES (:u,'totp',FALSE,'Authenticator App',:sec,TRUE)",[uuidParam("u",uuid),strParam("sec",secret)]);
      return ok({secret,otpauth},event);
    }

    // POST /api/v1/auth/totp/activate — confirm first code, activate factor, return recovery codes
    if(method==="POST"&&path==="/api/v1/auth/totp/activate"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const {code}=body;
      if(!code)return err("code required",event,400);
      const pending=await sql("SELECT id,totp_secret FROM user_security_factors WHERE traveler_uuid=:u AND factor_type='totp' AND totp_pending=TRUE",[uuidParam("u",uuid)]);
      if(!pending.length)return err("No pending TOTP enrollment",event,400);
      const {id:factorId,totp_secret}=pending[0];
      if(!totpVerify(totp_secret,String(code).trim()))return err("Invalid code",event,400);
      await sql("UPDATE user_security_factors SET is_active=TRUE,totp_pending=FALSE,updated_at=NOW() WHERE id=:fid",[uuidParam("fid",factorId)]);
      // Generate 10 recovery codes (invalidate any previous)
      await sql("DELETE FROM user_recovery_codes WHERE traveler_uuid=:u",[uuidParam("u",uuid)]);
      const codes=[];
      for(let i=0;i<10;i++){const c=genRecoveryCode();codes.push(c);await sql("INSERT INTO user_recovery_codes (traveler_uuid,code_hash) VALUES (:u,:h)",[uuidParam("u",uuid),strParam("h",hashCode(c))]);}
      await logSecEvent(uuid,"totp_enrolled",{},event);
      return ok({success:true,recovery_codes:codes},event,201);
    }

    // POST /api/v1/auth/totp/verify — verify TOTP and issue a step-up token
    if(method==="POST"&&path==="/api/v1/auth/totp/verify"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const {code}=body;
      if(!code)return err("code required",event,400);
      const factor=await sql("SELECT totp_secret FROM user_security_factors WHERE traveler_uuid=:u AND factor_type='totp' AND is_active=TRUE",[uuidParam("u",uuid)]);
      if(!factor.length)return err("No active TOTP factor",event,400);
      if(!totpVerify(factor[0].totp_secret,String(code).trim()))return err("Invalid code",event,400);
      // Issue step-up token (5-min TTL); clean old ones first
      await sql("DELETE FROM user_step_up_tokens WHERE traveler_uuid=:u OR expires_at < NOW()",[uuidParam("u",uuid)]);
      const rawToken=genStepUpToken();
      const exp=new Date(Date.now()+5*60*1000);
      await sql("INSERT INTO user_step_up_tokens (traveler_uuid,token_hash,expires_at) VALUES (:u,:h,:exp)",[uuidParam("u",uuid),strParam("h",hashCode(rawToken)),strParam("exp",exp.toISOString())]);
      await logSecEvent(uuid,"step_up_granted",{factor:"totp"},event);
      return ok({step_up_token:rawToken,expires_at:exp.toISOString()},event);
    }

    // GET /api/v1/auth/step-up/check — verify a step-up token is still valid
    if(method==="GET"&&path==="/api/v1/auth/step-up/check"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const rawToken=(event.headers&&(event.headers['x-step-up-token']||event.headers['X-Step-Up-Token']))||"";
      if(!rawToken)return ok({valid:false},event);
      const rows=await sql("SELECT 1 FROM user_step_up_tokens WHERE traveler_uuid=:u AND token_hash=:h AND expires_at>NOW()",[uuidParam("u",uuid),strParam("h",hashCode(rawToken))]);
      return ok({valid:rows.length>0},event);
    }

    // POST /api/v1/auth/recovery-codes/regenerate — generate new set (Level 2, invalidates old)
    if(method==="POST"&&path==="/api/v1/auth/recovery-codes/regenerate"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      // Must have an active factor
      const activeFactor=await sql("SELECT 1 FROM user_security_factors WHERE traveler_uuid=:u AND is_active=TRUE",[uuidParam("u",uuid)]);
      if(!activeFactor.length)return err("No active 2FA factor",event,403);
      await sql("DELETE FROM user_recovery_codes WHERE traveler_uuid=:u",[uuidParam("u",uuid)]);
      const codes=[];
      for(let i=0;i<10;i++){const c=genRecoveryCode();codes.push(c);await sql("INSERT INTO user_recovery_codes (traveler_uuid,code_hash) VALUES (:u,:h)",[uuidParam("u",uuid),strParam("h",hashCode(c))]);}
      await logSecEvent(uuid,"recovery_codes_regenerated",{},event);
      return ok({recovery_codes:codes},event,201);
    }

    // POST /api/v1/auth/recovery-codes/verify — use a recovery code (grants Level 1 equivalent step-up bypass)
    if(method==="POST"&&path==="/api/v1/auth/recovery-codes/verify"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const {code}=body;
      if(!code)return err("code required",event,400);
      const h=hashCode(String(code));
      const row=await sql("SELECT id FROM user_recovery_codes WHERE traveler_uuid=:u AND code_hash=:h AND used_at IS NULL",[uuidParam("u",uuid),strParam("h",h)]);
      if(!row.length)return err("Invalid or already-used recovery code",event,400);
      await sql("UPDATE user_recovery_codes SET used_at=NOW() WHERE id=:id",[uuidParam("id",row[0].id)]);
      const remaining=await sql("SELECT COUNT(*) as cnt FROM user_recovery_codes WHERE traveler_uuid=:u AND used_at IS NULL",[uuidParam("u",uuid)]);
      await logSecEvent(uuid,"recovery_code_used",{remaining:parseInt(remaining[0]&&remaining[0].cnt)||0},event);
      return ok({success:true,remaining:parseInt(remaining[0]&&remaining[0].cnt)||0},event);
    }

    // DELETE /api/v1/auth/factors/{factorId} — remove a security factor
    if(method==="DELETE"&&path.match(/^\/api\/v1\/auth\/factors\/[^/]+$/)){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const factorId=path.split("/").pop();
      const factor=await sql("SELECT factor_type FROM user_security_factors WHERE id=:fid AND traveler_uuid=:u",[uuidParam("fid",factorId),uuidParam("u",uuid)]);
      if(!factor.length)return err("Factor not found",event,404);
      await sql("DELETE FROM user_security_factors WHERE id=:fid AND traveler_uuid=:u",[uuidParam("fid",factorId),uuidParam("u",uuid)]);
      await logSecEvent(uuid,"factor_removed",{factor_type:factor[0].factor_type},event);
      return ok({success:true},event);
    }

    // GET /api/v1/auth/events — recent security events (last 50)
    if(method==="GET"&&path==="/api/v1/auth/events"){
      const token=await verifyToken(event);
      const uuid=await getOrCreateTraveler(token.sub,token.email);
      const events=await sql("SELECT event_type,ip_address,metadata,created_at FROM auth_security_events WHERE traveler_uuid=:u ORDER BY created_at DESC LIMIT 50",[uuidParam("u",uuid)]);
      return ok({events},event);
    }
    // ── End Auth Security ─────────────────────────────────────────────────────

    // ── Notifications ─────────────────────────────────────────────────────────
    // GET /api/v1/notifications
    if(method==="GET"&&path==="/api/v1/notifications"){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const rows=await sql(
        "SELECT id,trip_group_id,kind,payload,read_at,snooze_until,created_at FROM trip_group_notifications WHERE recipient_uuid=:u AND read_at IS NULL AND (snooze_until IS NULL OR snooze_until<=NOW()) ORDER BY created_at DESC LIMIT 50",
        [uuidParam("u",myUuid)]);
      return ok(rows.map(function(r){try{return Object.assign({},r,{payload:typeof r.payload==='string'?JSON.parse(r.payload):(r.payload||{})});}catch(e){return r;}}),event);
    }
    // PATCH /api/v1/notifications/{id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/notifications\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const notifId=path.split('/').filter(Boolean)[3];
      const {action}=body;
      if(!action||!['read','snooze'].includes(action))return err("action must be 'read' or 'snooze'",event,400);
      const rows=await sql("SELECT id,kind,trip_group_id,payload FROM trip_group_notifications WHERE id=:id::uuid AND recipient_uuid=:u",[strParam("id",notifId),uuidParam("u",myUuid)]);
      if(!rows.length)return err("Notification not found",event,404);
      if(action==='read'){
        await sql("UPDATE trip_group_notifications SET read_at=NOW() WHERE id=:id::uuid AND recipient_uuid=:u",[strParam("id",notifId),uuidParam("u",myUuid)]);
      }else{
        await sql("UPDATE trip_group_notifications SET snooze_until=NOW()+INTERVAL '7 days' WHERE id=:id::uuid AND recipient_uuid=:u",[strParam("id",notifId),uuidParam("u",myUuid)]);
      }
      return ok({success:true},event);
    }
    // ── Trip Group Invite (invitee-facing) ────────────────────────────────────
    // GET /api/v1/trip-groups/invite/{consent_id}
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/invite\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const consentId=path.split('/').filter(Boolean)[4];
      const rows=await sql(
        "SELECT c.id,c.trip_group_id,c.requester_uuid,c.target_uuid,c.status,c.requested_scopes,c.requested_at,tg.name AS group_name,tg.destination,t.trip_name,t.departure_date,t.return_date,t.destination_iata FROM trip_group_consents c JOIN traveler_groups tg ON tg.id=c.trip_group_id LEFT JOIN trips t ON t.id=tg.trip_id WHERE c.id=:cid::uuid",
        [strParam("cid",consentId)]);
      if(!rows.length)return err("Invitation not found",event,404);
      const consent=rows[0];
      // Wrong account check
      if(consent.target_uuid!==myUuid)return err("This invitation isn't for your account. Please sign in with the account that received this invite.",event,403);
      const destIata=(consent.destination_iata||consent.destination||'').trim().toUpperCase().slice(0,3);
      const orgName=await getTravelerDisplayName(consent.requester_uuid);
      return ok({consent_id:consent.id,status:consent.status,group_id:consent.trip_group_id,group_name:consent.group_name,trip_name:consent.trip_name,destination:destIata,destination_name:(RULES[destIata]||{}).name||destIata,departure_date:consent.departure_date,return_date:consent.return_date,organizer_name:orgName,requested_scopes:typeof consent.requested_scopes==="string"?JSON.parse(consent.requested_scopes):(consent.requested_scopes||[]),requested_at:consent.requested_at},event);
    }
    // POST /api/v1/trip-groups/invite/{consent_id}/accept
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/invite\/[^/]+\/accept$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const consentId=path.split('/').filter(Boolean)[4];
      const rows=await sql("SELECT id,trip_group_id,requester_uuid,target_uuid,status FROM trip_group_consents WHERE id=:cid::uuid",[strParam("cid",consentId)]);
      if(!rows.length)return err("Invitation not found",event,404);
      const consent=rows[0];
      if(consent.target_uuid!==myUuid)return err("This invitation isn't for your account.",event,403);
      if(consent.status!=='pending')return err("Invitation is no longer pending (status: "+consent.status+")",event,409);
      const rawGranted=body&&body.granted_scopes;
      const grantedJson=(Array.isArray(rawGranted)&&rawGranted.length)?JSON.stringify(rawGranted):null;
      await sql(grantedJson?"UPDATE trip_group_consents SET status='approved',granted_scopes=:gs::jsonb,responded_at=NOW() WHERE id=:cid::uuid":"UPDATE trip_group_consents SET status='approved',granted_scopes=requested_scopes,responded_at=NOW() WHERE id=:cid::uuid",grantedJson?[strParam("gs",grantedJson),strParam("cid",consentId)]:[strParam("cid",consentId)]);
      // Mark related notification read
      await sql("UPDATE trip_group_notifications SET read_at=NOW() WHERE recipient_uuid=:u AND trip_group_id=:gid AND kind='group_invite' AND read_at IS NULL",[uuidParam("u",myUuid),strParam("gid",consent.trip_group_id)]);
      writeAuditLog(consent.trip_group_id,myUuid,'consent_approved',consent.requester_uuid,{consent_id:consentId});
      writeNotification(consent.requester_uuid,consent.trip_group_id,'sharing_approved',{member_uuid:myUuid});
      return ok({success:true,group_id:consent.trip_group_id},event);
    }
    // POST /api/v1/trip-groups/invite/{consent_id}/decline
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/invite\/[^/]+\/decline$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const consentId=path.split('/').filter(Boolean)[4];
      const rows=await sql("SELECT id,trip_group_id,requester_uuid,target_uuid,status FROM trip_group_consents WHERE id=:cid::uuid",[strParam("cid",consentId)]);
      if(!rows.length)return err("Invitation not found",event,404);
      const consent=rows[0];
      if(consent.target_uuid!==myUuid)return err("This invitation isn't for your account.",event,403);
      if(consent.status!=='pending')return err("Invitation is no longer pending (status: "+consent.status+")",event,409);
      await sql("UPDATE trip_group_consents SET status='declined',revoked_by='member',responded_at=NOW() WHERE id=:cid::uuid",[strParam("cid",consentId)]);
      await sql("UPDATE trip_group_notifications SET read_at=NOW() WHERE recipient_uuid=:u AND trip_group_id=:gid AND kind='group_invite' AND read_at IS NULL",[uuidParam("u",myUuid),strParam("gid",consent.trip_group_id)]);
      writeAuditLog(consent.trip_group_id,myUuid,'consent_declined',consent.requester_uuid,{consent_id:consentId});
      writeNotification(consent.requester_uuid,consent.trip_group_id,'sharing_declined',{member_uuid:myUuid});
      return ok({success:true},event);
    }
    // ── Leave Group ───────────────────────────────────────────────────────────
    // POST /api/v1/trip-groups/{group_id}/leave
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/leave$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      // Must be a joined member, not organizer
      const consentRows=await sql("SELECT id FROM trip_group_consents WHERE trip_group_id=:gid AND target_uuid=:u AND status='approved'",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      if(!consentRows.length)return err("You are not a member of this group",event,403);
      await sql("UPDATE trip_group_consents SET status='declined',revoked_by='member',responded_at=NOW() WHERE trip_group_id=:gid AND target_uuid=:u AND status='approved'",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      // Get organizer uuid to notify
      const grpRows=await sql("SELECT owner_uuid FROM traveler_groups WHERE id=:id",[strParam("id",groupId)]);
      if(grpRows.length){
        writeAuditLog(groupId,myUuid,'member_left',grpRows[0].owner_uuid,{});
        writeNotification(grpRows[0].owner_uuid,groupId,'member_left',{member_uuid:myUuid});
      }
      return ok({success:true},event);
    }
    // ── Workspace ─────────────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/workspace
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace$/)&&!path.includes('/accommodations')&&!path.includes('/references')){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const rows=await sql("SELECT trip_notes,accommodations,reference_numbers,updated_at,updated_by FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      if(!rows.length)return ok({trip_group_id:groupId,trip_notes:null,accommodations:[],reference_numbers:[],updated_at:null},event);
      const ws=rows[0];
      return ok({trip_group_id:groupId,trip_notes:ws.trip_notes,accommodations:typeof ws.accommodations==="string"?JSON.parse(ws.accommodations):(ws.accommodations||[]),reference_numbers:typeof ws.reference_numbers==="string"?JSON.parse(ws.reference_numbers):(ws.reference_numbers||[]),updated_at:ws.updated_at},event);
    }
    // PATCH /api/v1/trip-groups/{group_id}/workspace/notes
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/notes$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can edit workspace notes",event,403);
      const {trip_notes}=body;
      await sql("INSERT INTO trip_group_workspace(trip_group_id,trip_notes,accommodations,reference_numbers,updated_at,updated_by) VALUES(:id,:notes,'[]'::jsonb,'[]'::jsonb,NOW(),:u::uuid) ON CONFLICT(trip_group_id) DO UPDATE SET trip_notes=:notes,updated_at=NOW(),updated_by=:u::uuid",
        [strParam("id",groupId),strParam("notes",trip_notes||null),strParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'workspace_notes_updated',null,{});
      return ok({success:true},event);
    }
    // POST /api/v1/trip-groups/{group_id}/workspace/accommodations
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/accommodations$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can add accommodations",event,403);
      const {name,address,check_in,check_out,confirmation_number,notes}=body;
      if(!name)return err("name required",event,400);
      const {randomBytes}=require('crypto');
      const itemId='acc-'+randomBytes(6).toString('hex');
      const newItem={id:itemId,name,address:address||null,check_in:check_in||null,check_out:check_out||null,confirmation_number:confirmation_number||null,notes:notes||null};
      const ws=await sql("SELECT accommodations FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].accommodations==="string"?JSON.parse(ws[0].accommodations):(ws[0].accommodations||[])):[];
      items.push(newItem);
      await sql("INSERT INTO trip_group_workspace(trip_group_id,trip_notes,accommodations,reference_numbers,updated_at,updated_by) VALUES(:id,NULL,:acc::jsonb,'[]'::jsonb,NOW(),:u::uuid) ON CONFLICT(trip_group_id) DO UPDATE SET accommodations=:acc::jsonb,updated_at=NOW(),updated_by=:u::uuid",
        [strParam("id",groupId),strParam("acc",JSON.stringify(items)),strParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'workspace_accommodation_added',null,{name:newItem.name,id:newItem.id});
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify(newItem)};
    }
    // PATCH /api/v1/trip-groups/{group_id}/workspace/accommodations/{item_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/accommodations\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[6];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can edit accommodations",event,403);
      const ws=await sql("SELECT accommodations FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].accommodations==="string"?JSON.parse(ws[0].accommodations):(ws[0].accommodations||[])):[];
      const idx=items.findIndex(function(i){return i.id===itemId;});
      if(idx===-1)return err("Accommodation not found",event,404);
      Object.assign(items[idx],body,{id:itemId});
      await sql("UPDATE trip_group_workspace SET accommodations=:acc::jsonb,updated_at=NOW(),updated_by=:u::uuid WHERE trip_group_id=:id",
        [strParam("acc",JSON.stringify(items)),strParam("u",myUuid),strParam("id",groupId)]);
      writeAuditLog(groupId,myUuid,'workspace_accommodation_edited',null,{id:itemId});
      return ok({success:true},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}/workspace/accommodations/{item_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/accommodations\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[6];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can delete accommodations",event,403);
      const ws=await sql("SELECT accommodations FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].accommodations==="string"?JSON.parse(ws[0].accommodations):(ws[0].accommodations||[])):[];
      const updated=items.filter(function(i){return i.id!==itemId;});
      if(updated.length===items.length)return err("Accommodation not found",event,404);
      await sql("UPDATE trip_group_workspace SET accommodations=:acc::jsonb,updated_at=NOW(),updated_by=:u::uuid WHERE trip_group_id=:id",
        [strParam("acc",JSON.stringify(updated)),strParam("u",myUuid),strParam("id",groupId)]);
      writeAuditLog(groupId,myUuid,'workspace_accommodation_removed',null,{id:itemId});
      return ok({success:true},event);
    }
    // POST /api/v1/trip-groups/{group_id}/workspace/references
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/references$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can add references",event,403);
      const {label,value,notes}=body;
      if(!label||!value)return err("label and value required",event,400);
      const {randomBytes}=require('crypto');
      const itemId='ref-'+randomBytes(6).toString('hex');
      const newItem={id:itemId,label,value,notes:notes||null};
      const ws=await sql("SELECT reference_numbers FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].reference_numbers==="string"?JSON.parse(ws[0].reference_numbers):(ws[0].reference_numbers||[])):[];
      items.push(newItem);
      await sql("INSERT INTO trip_group_workspace(trip_group_id,trip_notes,accommodations,reference_numbers,updated_at,updated_by) VALUES(:id,NULL,'[]'::jsonb,:refs::jsonb,NOW(),:u::uuid) ON CONFLICT(trip_group_id) DO UPDATE SET reference_numbers=:refs::jsonb,updated_at=NOW(),updated_by=:u::uuid",
        [strParam("id",groupId),strParam("refs",JSON.stringify(items)),strParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'workspace_reference_added',null,{label,id:itemId});
      return{statusCode:201,headers:cors(go(event)),body:JSON.stringify(newItem)};
    }
    // PATCH /api/v1/trip-groups/{group_id}/workspace/references/{item_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/references\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[6];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can edit references",event,403);
      const ws=await sql("SELECT reference_numbers FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].reference_numbers==="string"?JSON.parse(ws[0].reference_numbers):(ws[0].reference_numbers||[])):[];
      const idx=items.findIndex(function(i){return i.id===itemId;});
      if(idx===-1)return err("Reference not found",event,404);
      Object.assign(items[idx],body,{id:itemId});
      await sql("UPDATE trip_group_workspace SET reference_numbers=:refs::jsonb,updated_at=NOW(),updated_by=:u::uuid WHERE trip_group_id=:id",
        [strParam("refs",JSON.stringify(items)),strParam("u",myUuid),strParam("id",groupId)]);
      writeAuditLog(groupId,myUuid,'workspace_reference_edited',null,{id:itemId});
      return ok({success:true},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}/workspace/references/{item_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/workspace\/references\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[6];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      if(role!=='organizer')return err("Only the organizer can delete references",event,403);
      const ws=await sql("SELECT reference_numbers FROM trip_group_workspace WHERE trip_group_id=:id",[strParam("id",groupId)]);
      const items=ws.length?(typeof ws[0].reference_numbers==="string"?JSON.parse(ws[0].reference_numbers):(ws[0].reference_numbers||[])):[];
      const updated=items.filter(function(i){return i.id!==itemId;});
      if(updated.length===items.length)return err("Reference not found",event,404);
      await sql("UPDATE trip_group_workspace SET reference_numbers=:refs::jsonb,updated_at=NOW(),updated_by=:u::uuid WHERE trip_group_id=:id",
        [strParam("refs",JSON.stringify(updated)),strParam("u",myUuid),strParam("id",groupId)]);
      writeAuditLog(groupId,myUuid,'workspace_reference_removed',null,{id:itemId});
      return ok({success:true},event);
    }
    // ── Itinerary ─────────────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/itinerary
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/itinerary$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const rows=await sql("SELECT id,day_date,time_label,title,location,notes,sort_order,created_by,created_at,updated_at FROM trip_itinerary_items WHERE trip_group_id=:gid ORDER BY day_date ASC,sort_order ASC,created_at ASC",[strParam("gid",groupId)]);
      return ok(rows,event);
    }
    // POST /api/v1/trip-groups/{group_id}/itinerary
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/itinerary$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {row}=await validateTripGroupAccess(groupId,myUuid);
      const {day_date,time_label,title,location,notes}=body||{};
      if(!day_date||!title)return err("day_date and title are required",event,400);
      const maxRows=await sql("SELECT COALESCE(MAX(sort_order),0) AS m FROM trip_itinerary_items WHERE trip_group_id=:gid AND day_date=:d::date",[strParam("gid",groupId),strParam("d",day_date)]);
      const nextOrder=((maxRows[0]&&maxRows[0].m)||0)+1;
      const inserted=await sql("INSERT INTO trip_itinerary_items(trip_group_id,day_date,time_label,title,location,notes,sort_order,created_by) VALUES(:gid,:d::date,:tl,:title,:loc,:notes,:so,:u::uuid) RETURNING id,day_date,time_label,title,location,notes,sort_order,created_by,created_at",
        [strParam("gid",groupId),strParam("d",day_date),strParam("tl",time_label||null),strParam("title",title),strParam("loc",location||null),strParam("notes",notes||null),{name:"so",value:{longValue:nextOrder}},strParam("u",myUuid)]);
      const item=inserted[0];
      writeAuditLog(groupId,myUuid,'itinerary_added',null,{item_id:item.id,title,day_date});
      const actorName=await getTravelerDisplayName(myUuid);
      const notifPayload={actor_name:actorName,title,day_date,group_id:groupId};
      const otherMembers=await sql("SELECT target_uuid FROM trip_group_consents WHERE trip_group_id=:gid AND status='approved' AND target_uuid<>:u::uuid",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      for(const m of otherMembers)writeNotification(m.target_uuid,groupId,'itinerary_added',notifPayload);
      if(row.owner_uuid&&row.owner_uuid!==myUuid)writeNotification(row.owner_uuid,groupId,'itinerary_added',notifPayload);
      return ok(item,event);
    }
    // PATCH /api/v1/trip-groups/{group_id}/itinerary/{item_id}/reorder
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/itinerary\/[^/]+\/reorder$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[5];
      await validateTripGroupAccess(groupId,myUuid);
      const {sort_order}=body||{};
      if(sort_order===undefined||sort_order===null)return err("sort_order is required",event,400);
      const existing=await sql("SELECT id FROM trip_itinerary_items WHERE id=:iid::uuid AND trip_group_id=:gid",[strParam("iid",itemId),strParam("gid",groupId)]);
      if(!existing.length)return err("Item not found",event,404);
      await sql("UPDATE trip_itinerary_items SET sort_order=:so,updated_at=NOW() WHERE id=:iid::uuid",[{name:"so",value:{longValue:sort_order}},strParam("iid",itemId)]);
      return ok({success:true},event);
    }
    // PATCH /api/v1/trip-groups/{group_id}/itinerary/{item_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/itinerary\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[5];
      await validateTripGroupAccess(groupId,myUuid);
      const {day_date,time_label,title,location,notes}=body||{};
      if(!day_date||!title)return err("day_date and title are required",event,400);
      const existing=await sql("SELECT id FROM trip_itinerary_items WHERE id=:iid::uuid AND trip_group_id=:gid",[strParam("iid",itemId),strParam("gid",groupId)]);
      if(!existing.length)return err("Item not found",event,404);
      await sql("UPDATE trip_itinerary_items SET day_date=:d::date,time_label=:tl,title=:title,location=:loc,notes=:notes,updated_at=NOW(),updated_by=:u::uuid WHERE id=:iid::uuid",
        [strParam("d",day_date),strParam("tl",time_label||null),strParam("title",title),strParam("loc",location||null),strParam("notes",notes||null),strParam("u",myUuid),strParam("iid",itemId)]);
      writeAuditLog(groupId,myUuid,'itinerary_edited',null,{item_id:itemId,title});
      return ok({success:true},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}/itinerary/{item_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/itinerary\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],itemId=parts[5];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const existing=await sql("SELECT id,created_by,title FROM trip_itinerary_items WHERE id=:iid::uuid AND trip_group_id=:gid",[strParam("iid",itemId),strParam("gid",groupId)]);
      if(!existing.length)return err("Item not found",event,404);
      const item=existing[0];
      if(item.created_by!==myUuid&&role!=='organizer')return err("Only the creator or organizer can remove this item",event,403);
      await sql("DELETE FROM trip_itinerary_items WHERE id=:iid::uuid",[strParam("iid",itemId)]);
      writeAuditLog(groupId,myUuid,'itinerary_removed',null,{item_id:itemId,title:item.title});
      return ok({success:true},event);
    }
    // ── Trip Documents ────────────────────────────────────────────────────────
    // POST /api/v1/trip-groups/{group_id}/documents/upload-url
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/documents\/upload-url$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const {filename,mime_type,file_size_bytes}=body||{};
      if(!filename||!mime_type||!file_size_bytes)return err("filename, mime_type, and file_size_bytes are required",event,400);
      const ALLOWED_MIME=['application/pdf','image/jpeg','image/png','image/heic','image/webp'];
      if(!ALLOWED_MIME.includes(mime_type))return err("File type not allowed. Accepted: PDF, JPEG, PNG, HEIC, WebP",event,400);
      if(file_size_bytes>10485760)return err("File exceeds 10 MB limit",event,400);
      const countRows=await sql("SELECT COUNT(*)::int AS c FROM trip_documents WHERE trip_group_id=:gid",[strParam("gid",groupId)]);
      const docCount=Number((countRows[0]&&countRows[0].c)||0);
      const {randomBytes}=require('crypto');
      const b=randomBytes(16);b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
      const docId=b.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
      const safeName=filename.replace(/[^a-zA-Z0-9._-]/g,'_');
      const s3Key=`trip-documents/${groupId}/${docId}-${safeName}`;
      const uploadUrl=await getSignedUrl(s3,new PutObjectCommand({Bucket:DOCS_BUCKET,Key:s3Key,ContentType:mime_type,ContentLength:file_size_bytes}),{expiresIn:900});
      return ok({upload_url:uploadUrl,s3_key:s3Key,doc_id:docId,expires_at:new Date(Date.now()+900000).toISOString(),near_limit:docCount>=18},event);
    }
    // POST /api/v1/trip-groups/{group_id}/documents (finalize after S3 upload)
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/documents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {row}=await validateTripGroupAccess(groupId,myUuid);
      const {label,filename,s3_key,mime_type,file_size_bytes,doc_id}=body||{};
      if(!filename||!s3_key||!mime_type||!file_size_bytes)return err("filename, s3_key, mime_type, and file_size_bytes are required",event,400);
      const finalLabel=(label&&label.trim())||filename;
      await sql("INSERT INTO trip_documents(id,trip_group_id,label,filename,s3_key,mime_type,file_size_bytes,uploaded_by) VALUES(:id::uuid,:gid,:label,:filename,:s3key,:mime,:size::int,:u::uuid)",
        [strParam("id",doc_id),strParam("gid",groupId),strParam("label",finalLabel),strParam("filename",filename),strParam("s3key",s3_key),strParam("mime",mime_type),{name:"size",value:{longValue:Number(file_size_bytes)}},strParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'document_added',null,{doc_id,filename,label:finalLabel});
      const actorName=await getTravelerDisplayName(myUuid);
      const notifPayload={actor_name:actorName,filename,label:finalLabel,group_id:groupId};
      const otherMembers=await sql("SELECT target_uuid FROM trip_group_consents WHERE trip_group_id=:gid AND status='approved' AND target_uuid<>:u::uuid",[strParam("gid",groupId),uuidParam("u",myUuid)]);
      for(const m of otherMembers)writeNotification(m.target_uuid,groupId,'document_added',notifPayload);
      if(row.owner_uuid&&row.owner_uuid!==myUuid)writeNotification(row.owner_uuid,groupId,'document_added',notifPayload);
      const inserted=await sql("SELECT id,label,filename,mime_type,file_size_bytes,uploaded_by,uploaded_at FROM trip_documents WHERE id=:id::uuid",[strParam("id",doc_id)]);
      return ok(inserted[0]||{id:doc_id,label:finalLabel,filename,mime_type,file_size_bytes,uploaded_by:myUuid},event);
    }
    // GET /api/v1/trip-groups/{group_id}/documents
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/documents$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const rows=await sql("SELECT d.id,d.label,d.filename,d.mime_type,d.file_size_bytes,d.uploaded_by,d.uploaded_at,i.legal_first,i.legal_last FROM trip_documents d LEFT JOIN travelers t ON t.uuid=d.uploaded_by LEFT JOIN traveler_identity i ON i.traveler_uuid=t.uuid WHERE d.trip_group_id=:gid ORDER BY d.uploaded_at ASC",[strParam("gid",groupId)]);
      return ok(rows.map(function(r){return{id:r.id,label:r.label,filename:r.filename,mime_type:r.mime_type,file_size_bytes:r.file_size_bytes,uploaded_by:r.uploaded_by,uploader_name:([r.legal_first,r.legal_last].filter(Boolean).join(' ')||'A member'),uploaded_at:r.uploaded_at};}),event);
    }
    // GET /api/v1/trip-groups/{group_id}/documents/{doc_id}/download-url
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/documents\/[^/]+\/download-url$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],docId=parts[5];
      await validateTripGroupAccess(groupId,myUuid);
      const docs=await sql("SELECT id,filename,s3_key FROM trip_documents WHERE id=:id::uuid AND trip_group_id=:gid",[strParam("id",docId),strParam("gid",groupId)]);
      if(!docs.length)return err("Document not found",event,404);
      const doc=docs[0];
      const downloadUrl=await getSignedUrl(s3,new GetObjectCommand({Bucket:DOCS_BUCKET,Key:doc.s3_key,ResponseContentDisposition:`attachment; filename="${doc.filename}"`}),{expiresIn:900});
      return ok({download_url:downloadUrl,expires_in:900},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}/documents/{doc_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/documents\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],docId=parts[5];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const docs=await sql("SELECT id,filename,s3_key,uploaded_by FROM trip_documents WHERE id=:id::uuid AND trip_group_id=:gid",[strParam("id",docId),strParam("gid",groupId)]);
      if(!docs.length)return err("Document not found",event,404);
      const doc=docs[0];
      if(doc.uploaded_by!==myUuid&&role!=='organizer')return err("Only the uploader or organizer can delete this document",event,403);
      await sql("DELETE FROM trip_documents WHERE id=:id::uuid",[strParam("id",docId)]);
      try{await s3.send(new DeleteObjectCommand({Bucket:DOCS_BUCKET,Key:doc.s3_key}));}catch(e){console.warn("S3 delete failed:",e.message);}
      writeAuditLog(groupId,myUuid,'document_removed',null,{doc_id:docId,filename:doc.filename});
      return ok({success:true},event);
    }
    // ── Emergency Contacts ────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/emergency-contacts
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/emergency-contacts$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const rows=await sql("SELECT id,contact_name,relationship_label,phone,owner_uuid,created_at FROM trip_group_emergency_contacts WHERE trip_group_id=:gid ORDER BY created_at ASC",[strParam("gid",groupId)]);
      return ok(rows.map(function(r){return{...r,created_by:r.owner_uuid};}),event);
    }
    // POST /api/v1/trip-groups/{group_id}/emergency-contacts
    if(method==="POST"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/emergency-contacts$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupAccess(groupId,myUuid);
      const {contact_name,relationship_label,phone}=body;
      if(!contact_name||!phone)return err("contact_name and phone are required",event,400);
      const id=require('crypto').randomUUID();
      const inserted=await sql("INSERT INTO trip_group_emergency_contacts(id,trip_group_id,contact_name,relationship_label,phone,owner_uuid) VALUES(:id::uuid,:gid,:name,:rel,:phone,:u::uuid) RETURNING id,contact_name,relationship_label,phone,owner_uuid,created_at",
        [strParam("id",id),strParam("gid",groupId),strParam("name",contact_name),strParam("rel",relationship_label||null),strParam("phone",phone),strParam("u",myUuid)]);
      writeAuditLog(groupId,myUuid,'emergency_contact_added',null,{contact_id:id,contact_name});
      const row=inserted[0];
      return ok({...row,created_by:row.owner_uuid},event);
    }
    // PATCH /api/v1/trip-groups/{group_id}/emergency-contacts/{contact_id}
    if(method==="PATCH"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/emergency-contacts\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],contactId=parts[5];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const existing=await sql("SELECT id,owner_uuid FROM trip_group_emergency_contacts WHERE id=:id::uuid AND trip_group_id=:gid",[strParam("id",contactId),strParam("gid",groupId)]);
      if(!existing.length)return err("Contact not found",event,404);
      if(existing[0].owner_uuid!==myUuid&&role!=='organizer')return err("Only the contact owner or organizer can edit this",event,403);
      const {contact_name,relationship_label,phone}=body;
      if(!contact_name||!phone)return err("contact_name and phone are required",event,400);
      const updated=await sql("UPDATE trip_group_emergency_contacts SET contact_name=:name,relationship_label=:rel,phone=:phone,updated_at=NOW() WHERE id=:id::uuid RETURNING id,contact_name,relationship_label,phone,owner_uuid,created_at",
        [strParam("name",contact_name),strParam("rel",relationship_label||null),strParam("phone",phone),strParam("id",contactId)]);
      const row=updated[0];
      return ok({...row,created_by:row.owner_uuid},event);
    }
    // DELETE /api/v1/trip-groups/{group_id}/emergency-contacts/{contact_id}
    if(method==="DELETE"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/emergency-contacts\/[^/]+$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const parts=path.split('/').filter(Boolean);
      const groupId=parts[3],contactId=parts[5];
      const {role}=await validateTripGroupAccess(groupId,myUuid);
      const existing=await sql("SELECT id,contact_name,owner_uuid FROM trip_group_emergency_contacts WHERE id=:id::uuid AND trip_group_id=:gid",[strParam("id",contactId),strParam("gid",groupId)]);
      if(!existing.length)return err("Contact not found",event,404);
      if(existing[0].owner_uuid!==myUuid&&role!=='organizer')return err("Only the contact owner or organizer can delete this",event,403);
      await sql("DELETE FROM trip_group_emergency_contacts WHERE id=:id::uuid",[strParam("id",contactId)]);
      writeAuditLog(groupId,myUuid,'emergency_contact_removed',null,{contact_id:contactId,contact_name:existing[0].contact_name});
      return ok({success:true},event);
    }
    // ── Audit Log ─────────────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/audit-log
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/audit-log$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      await validateTripGroupId(groupId,myUuid);
      const rows=await sql("SELECT l.id,l.actor_uuid,l.action,l.target_uuid,l.payload,l.created_at,COALESCE(NULLIF(TRIM(i.legal_first||' '||i.legal_last),''),t.display_name,t.email) AS actor_name FROM trip_group_audit_log l LEFT JOIN travelers t ON t.uuid=l.actor_uuid LEFT JOIN traveler_identity i ON i.traveler_uuid=l.actor_uuid WHERE l.trip_group_id=:id ORDER BY l.created_at DESC LIMIT 100",[strParam("id",groupId)]);
      return ok(rows,event);
    }
    // ── Re-auth ───────────────────────────────────────────────────────────────
    // POST /api/v1/auth/verify-password
    if(method==="POST"&&path==="/api/v1/auth/verify-password"){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const {password}=body;
      if(!password)return err("password required",event,400);
      const userRows=await sql("SELECT email FROM travelers WHERE uuid=:u",[uuidParam("u",myUuid)]);
      if(!userRows.length)return err("User not found",event,404);
      const email=userRows[0].email;
      try{
        await cognito.send(new AdminInitiateAuthCommand({
          UserPoolId:process.env.COGNITO_USER_POOL_ID,
          ClientId:process.env.COGNITO_CLIENT_ID,
          AuthFlow:"ADMIN_USER_PASSWORD_AUTH",
          AuthParameters:{USERNAME:email,PASSWORD:password},
        }));
        return ok({verified:true},event);
      }catch(e){
        if(e.name==="NotAuthorizedException"||e.name==="UserNotFoundException")return err("Incorrect password",event,401);
        console.error("verify-password error:",e.message);
        return err("Password verification failed",event,500);
      }
    }
    // ── Air Sectors ───────────────────────────────────────────────────────────
    // GET /api/v1/trip-groups/{group_id}/segments
    // share_air_sectors scope: currently implied by existing group consent (status='approved').
    // Future: check c.granted_scopes includes 'air_sectors' for granular per-member control
    // without changing the consent UI — just a Lambda condition and a column add.
    if(method==="GET"&&path.match(/^\/api\/v1\/trip-groups\/[^/]+\/segments$/)){
      const token=await verifyToken(event);
      const myUuid=await getOrCreateTraveler(token.sub,token.email);
      const groupId=path.split('/').filter(Boolean)[3];
      const {row}=await validateTripGroupAccess(groupId,myUuid);
      if(!row.trip_id)return ok([],event);
      const rows=await sql(
        "SELECT id,segment_order,carrier,flight_number,origin_iata,destination_iata,departure_datetime,arrival_datetime,cabin_class FROM trip_segments WHERE trip_id=:tid::uuid AND segment_type='FLIGHT' ORDER BY segment_order ASC,departure_datetime ASC",
        [strParam("tid",row.trip_id)]
      );
      return ok(rows,event);
    }
    // ── End Gate 3 ────────────────────────────────────────────────────────────

    return err("Not found",event,404);
  }catch(e){
    if(e.status)return err(e.message,event,e.status);
    console.error("Unhandled error:",e);
    return{statusCode:500,headers:cors(go(event)),body:JSON.stringify({error:"Internal server error"})};
  }
};
