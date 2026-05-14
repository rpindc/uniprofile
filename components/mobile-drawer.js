(function(){
  var API='https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod';
  var CD='https://uniprofile-auth.auth.us-east-1.amazoncognito.com';
  var CID='2heljmdli4f9cv2i4m0i020mfc';

  var ham,drawer,scrim,closeBtn;
  var savedScrollY=0;
  var touchStartX=0;

  function getToken(){return localStorage.getItem('up_token');}

  function initials(name){
    if(!name||!name.trim())return'?';
    var parts=name.trim().split(/\s+/);
    if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
    return(parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }

  function openDrawer(){
    savedScrollY=window.scrollY;
    document.body.style.overflow='hidden';
    document.body.style.position='fixed';
    document.body.style.width='100%';
    document.body.style.top='-'+savedScrollY+'px';
    drawer.classList.add('open');
    drawer.removeAttribute('aria-hidden');
    scrim.classList.add('open');
    ham.setAttribute('aria-expanded','true');
    closeBtn.focus();
  }

  function closeDrawer(){
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    scrim.classList.remove('open');
    ham.setAttribute('aria-expanded','false');
    document.body.style.overflow='';
    document.body.style.position='';
    document.body.style.width='';
    document.body.style.top='';
    window.scrollTo(0,savedScrollY);
    ham.focus();
  }

  function onKeyDown(e){
    if(!drawer.classList.contains('open'))return;
    if(e.key==='Escape'){closeDrawer();return;}
    if(e.key!=='Tab')return;
    var focusable=Array.from(drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    if(!focusable.length)return;
    var first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey){
      if(document.activeElement===first){e.preventDefault();last.focus();}
    }else{
      if(document.activeElement===last){e.preventDefault();first.focus();}
    }
  }

  function setActivePage(){
    var path=window.location.pathname;
    var page=path.replace(/^\/+/,'').replace(/\.html$/,'');
    if(!page||page==='index')page='home';
    drawer.querySelectorAll('.mob-nav-item[data-page]').forEach(function(a){
      if(a.dataset.page===page){a.classList.add('active');}
      else{a.classList.remove('active');}
    });
  }

  function setInitials(inits){
    document.querySelectorAll('.mob-avatar-initials').forEach(function(el){
      el.textContent=inits;
    });
  }

  async function loadProfile(){
    var tok=getToken();
    if(!tok)return;
    try{
      var r=await fetch(API+'/api/v1/me',{headers:{Authorization:'Bearer '+tok}});
      if(!r.ok)return;
      var p=await r.json();
      var name=(p.display_name&&p.display_name.trim())||
               (p.identity&&p.identity.legal_first
                 ?(p.identity.legal_first+(p.identity.legal_last?' '+p.identity.legal_last:''))
                 :'')||
               p.uniprofile_number||'Traveler';
      var tier=p.tier||'free';
      var tierLabel=tier.charAt(0).toUpperCase()+tier.slice(1);
      var pct=p.profile_completeness||0;
      setInitials(initials(name));
      var nameEl=document.getElementById('mob-identity-name');
      if(nameEl)nameEl.textContent=name;
      var subEl=document.getElementById('mob-identity-sub');
      if(subEl)subEl.textContent=tierLabel+' · '+pct+'% complete';
    }catch(e){}
  }

  function signOut(){
    localStorage.removeItem('up_token');
    window.location.href=CD+'/logout?client_id='+CID+'&logout_uri='+encodeURIComponent(window.location.origin+'/');
  }

  document.addEventListener('DOMContentLoaded',function(){
    ham=document.getElementById('mob-hamburger');
    drawer=document.getElementById('mob-drawer');
    scrim=document.getElementById('mob-scrim');
    closeBtn=document.getElementById('mob-close');
    if(!ham||!drawer||!scrim||!closeBtn)return;

    ham.addEventListener('click',openDrawer);
    closeBtn.addEventListener('click',closeDrawer);
    scrim.addEventListener('click',closeDrawer);

    var identityBlock=document.getElementById('mob-identity-block');
    if(identityBlock){
      identityBlock.addEventListener('click',function(){
        closeDrawer();
        window.location.href='/me.html';
      });
      identityBlock.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();identityBlock.click();}
      });
    }

    var signOutBtn=document.getElementById('mob-signout-btn');
    if(signOutBtn)signOutBtn.addEventListener('click',signOut);

    drawer.querySelectorAll('.mob-nav-item[data-page]').forEach(function(a){
      a.addEventListener('click',function(){
        drawer.classList.remove('open');
        scrim.classList.remove('open');
        document.body.style.overflow='';
        document.body.style.position='';
        document.body.style.width='';
        document.body.style.top='';
        window.scrollTo(0,savedScrollY);
      });
    });

    /* Swipe left to close */
    drawer.addEventListener('touchstart',function(e){
      touchStartX=e.touches[0].clientX;
    },{passive:true});
    drawer.addEventListener('touchend',function(e){
      if(touchStartX-e.changedTouches[0].clientX>60)closeDrawer();
    },{passive:true});

    document.addEventListener('keydown',onKeyDown);

    setActivePage();
    loadProfile();
  });
})();
