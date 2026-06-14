/* ============================================================
 * Oriex — runtime data / theme helpers (hand-written, editable)
 * ------------------------------------------------------------
 * Extracted VERBATIM from the original index.html module prelude.
 * Assigns the following globals, consumed by the app bundle:
 *   window.__oxBg    — background image (IndexedDB) + theme settings
 *   window.__oxPbg   — profile background helper
 *   window.__oxAv    — avatar image helper
 *   window.__oxStudy — local study-minutes aggregation (7-day)
 *
 * These are good first targets to fold into the Repository layer
 * (see src/services/repository/ and MIGRATION.md, step 5).
 * ============================================================ */
import {
  savePhotoBlob,
  loadPhotoBlob,
  deletePhotoBlob,
  compressImageToBlob,
  homePhotoOverlayAlpha,
} from "../features/home/homePhotoStorage.js";

window.__oxBg=(function(){
  function uid(){return window.__oxUid||"local";}
  function sKey(u){return "oriex_theme_bg_settings_"+(u||"local");}
  function sKeyOld(u){return "oriex_bg_settings_"+(u||"local");}
  // cur.photo は Blob（新方式）または data URL 文字列（旧データ互換）。
  // cur.objUrl は Blob 表示用の Object URL（不要になったら revoke する）。
  var cur={uid:null,photo:null,objUrl:null,settings:{scale:1,x:50,y:50,opacity:1}};
  function idbGet(u){return loadPhotoBlob({uid:u});}
  function idbPut(u,val){return savePhotoBlob(val,{uid:u});}
  function idbDel(u){return deletePhotoBlob({uid:u});}
  function releaseObjUrl(){if(cur.objUrl){try{URL.revokeObjectURL(cur.objUrl);}catch(e){}cur.objUrl=null;}}
  // 背景/プレビューのCSSに使うURL。Blobなら必要時にObject URLを作って使い回す。
  function photoCssUrl(){
    if(!cur.photo){releaseObjUrl();return null;}
    if(typeof cur.photo==="string")return cur.photo; // 旧 data URL 互換
    if(!cur.objUrl){try{cur.objUrl=URL.createObjectURL(cur.photo);}catch(e){cur.objUrl=null;}}
    return cur.objUrl;
  }
  function loadSettings(u){try{var s=JSON.parse(localStorage.getItem(sKey(u))||localStorage.getItem(sKeyOld(u))||"null");if(s&&typeof s==="object")return{scale:+s.scale||1,x:s.x==null?50:+s.x,y:s.y==null?50:+s.y,opacity:s.opacity==null?1:+s.opacity};}catch(e){}return{scale:1,x:50,y:50,opacity:1};}
  function saveSettings(u,s){try{localStorage.setItem(sKey(u),JSON.stringify(s));}catch(e){}}
  var pv;
  var PHOTO_LAYER_ID="oxbg-photo-layer";
  function removePhotoLayer(){
    var layer=document.getElementById(PHOTO_LAYER_ID);
    if(layer&&layer.parentNode)layer.parentNode.removeChild(layer);
  }
  function ensurePhotoLayer(){
    if(!document.body)return null;
    var layer=document.getElementById(PHOTO_LAYER_ID);
    if(!layer){
      layer=document.createElement("div");
      layer.id=PHOTO_LAYER_ID;
      if(document.body.firstChild)document.body.insertBefore(layer,document.body.firstChild);
      else document.body.appendChild(layer);
    }
    layer.style.cssText=[
      "position:fixed",
      "inset:0",
      "z-index:0",
      "pointer-events:none",
      "background-image:linear-gradient(var(--oriex-home-photo-ov,rgba(255,255,255,.72)),var(--oriex-home-photo-ov,rgba(255,255,255,.72))),var(--oriex-home-photo-url)",
      "background-repeat:no-repeat,no-repeat",
      "background-attachment:fixed,fixed",
      "background-position:center,var(--oriex-home-photo-pos,center)",
      "background-size:cover,var(--oriex-home-photo-size,cover)"
    ].join(";");
    layer.style.position="fixed";
    layer.style.inset="0";
    layer.style.zIndex="0";
    layer.style.pointerEvents="none";
    layer.style.backgroundImage="linear-gradient(var(--oriex-home-photo-ov,rgba(255,255,255,.72)),var(--oriex-home-photo-ov,rgba(255,255,255,.72))),var(--oriex-home-photo-url)";
    layer.style.backgroundRepeat="no-repeat,no-repeat";
    layer.style.backgroundAttachment="fixed,fixed";
    layer.style.backgroundPosition="center,var(--oriex-home-photo-pos,center)";
    layer.style.backgroundSize="cover,var(--oriex-home-photo-size,cover)";
    return layer;
  }
  // v: home-theme-photo fix — 写真は body::before の固定レイヤーに CSS変数で描画する。
  // body.oxbg-on を実状態にして、legacy 側の白背景は写真ON時だけ透過させる。
  function injectCSS(){
    if(document.getElementById("oxbg-css"))return;
    var st=document.createElement("style");st.id="oxbg-css";
    st.textContent=[
      'html[data-home-photo="on"],',
      'body.oxbg-on,',
      'html[data-home-photo="on"] body,',
      'html[data-home-photo="on"] #root,',
      'body.oxbg-on #root,',
      'body.oxbg-on .rx-home,',
      'body.oxbg-on .rx-mp{background:transparent!important}',
      '#oxbg-photo-layer{position:fixed!important;inset:0!important;z-index:0!important;pointer-events:none!important}',
      'body.oxbg-on #root{position:relative!important;z-index:1!important;background:transparent!important}',
      'body.oxbg-on #root > div{background:transparent!important}',
      'body.oxbg-on #root > div[style*="position: fixed"]{background:transparent!important}',
      'body.oxbg-on #root > div > div[style*="radial-gradient"]{background:transparent!important;opacity:.18!important}',
      'body.oxbg-on::before,',
      'html[data-home-photo="on"] body::before{',
      'content:""!important;',
      'position:fixed!important;',
      'top:0!important;left:0!important;right:0!important;bottom:-180px!important;',
      'background-image:linear-gradient(var(--oriex-home-photo-ov,rgba(255,255,255,.72)),var(--oriex-home-photo-ov,rgba(255,255,255,.72))),var(--oriex-home-photo-url)!important;',
      'background-repeat:no-repeat,no-repeat!important;',
      'background-attachment:fixed,fixed!important;',
      'background-position:center,var(--oriex-home-photo-pos,center)!important;',
      'background-size:cover,var(--oriex-home-photo-size,cover)!important;',
      'pointer-events:none!important;',
      'z-index:auto!important}',
      'body.oxbg-on .rx-home,',
      'body.oxbg-on .rx-mp{--card:#fff!important;--line:rgba(15,23,42,.16)!important;--ink:#2b2724!important;--ink-soft:#5f5750!important}',
      'body.oxbg-on .rx-hero,',
      'body.oxbg-on .rx-q,',
      'body.oxbg-on .rx-menu,',
      'body.oxbg-on .rx-pcard,',
      'body.oxbg-on .rx-streak,',
      'body.oxbg-on .rx-peek,',
      'body.oxbg-on .rx-acct,',
      'body.oxbg-on .rx-bio,',
      'body.oxbg-on .rx-rec,',
      'body.oxbg-on .rx-rec-s,',
      'body.oxbg-on .rx-task,',
      'body.oxbg-on .rx-trow,',
      'body.oxbg-on .rx-talk,',
      'body.oxbg-on .rx-tabbar,',
      'body.oxbg-on .rx-cat:not(.on),',
      'body.oxbg-on .rx-schedule-hero,',
      'body.oxbg-on .rx-planbtn,',
      'body.oxbg-on .rx-calendar-grid,',
      'body.oxbg-on .rx-cal-day:not(.on),',
      'body.oxbg-on .rx-dirbtn:not(.on),',
      'body.oxbg-on .rx-frame-chip,',
      'body.oxbg-on .rx-tf,',
      'body.oxbg-on .rx-task-ctl button,',
      'body.oxbg-on .rx-task-ctl input,',
      'body.oxbg-on [class*="rounded"][style*="rgba(255,255,255,0.05)"],',
      'body.oxbg-on [class*="rounded"][style*="rgba(255, 255, 255, 0.05)"],',
      'body.oxbg-on [class*="rounded"][style*="rgba(255,255,255,0.08)"],',
      'body.oxbg-on [class*="rounded"][style*="rgba(255, 255, 255, 0.08)"],',
      'body.oxbg-on [class*="rounded"][style*="rgba(0,0,0,0.04)"],',
      'body.oxbg-on [class*="rounded"][style*="rgba(0, 0, 0, 0.04)"]{background:rgba(255,255,255,.88)!important;background:color-mix(in srgb,var(--card,#fff) 88%,transparent)!important;border-color:rgba(15,23,42,.16)!important;color:var(--ink,#2b2724)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}'
    ].join("");
    document.head.appendChild(st);
  }
  function ovAlpha(op){return homePhotoOverlayAlpha(op);}
  function applyPreview(){
    if(!pv)return;var s=cur.settings;var u=photoCssUrl();
    if(u){var sz=(s.scale&&s.scale>1.02)?((s.scale*100)+"%"):"cover";pv.style.backgroundImage="url('"+u+"')";pv.style.backgroundSize=sz;pv.style.backgroundPosition=s.x+"% "+s.y+"%";pv.style.boxShadow="inset 0 0 0 9999px rgba(255,255,255,"+ovAlpha(s.opacity)+")";pv.textContent="";}
    else{pv.style.backgroundImage="none";pv.style.boxShadow="none";pv.textContent="\u5199\u771F\u306A\u3057";}
  }
  function applyRoot(){
    injectCSS();var s=cur.settings;var root=document.documentElement;var u=photoCssUrl();
    if(u){
      var sz=(s.scale&&s.scale>1.02)?((s.scale*100)+"%"):"cover";
      var appRoot=document.getElementById("root");
      root.style.setProperty("--oriex-home-photo-url",'url("'+u+'")');
      root.style.setProperty("--oriex-home-photo-ov","rgba(255,255,255,"+ovAlpha(s.opacity)+")");
      root.style.setProperty("--oriex-home-photo-pos",s.x+"% "+s.y+"%");
      root.style.setProperty("--oriex-home-photo-size",sz);
      root.setAttribute("data-home-photo","on");
      if(document.body&&document.body.classList)document.body.classList.add("oxbg-on");
      if(appRoot&&appRoot.style){appRoot.style.position="relative";appRoot.style.zIndex="1";}
      ensurePhotoLayer();
    }else{
      // 写真なし: 属性と変数を消すだけ。通常テーマ（legacy/app.css）に戻る。
      root.removeAttribute("data-home-photo");
      root.style.removeProperty("--oriex-home-photo-url");
      root.style.removeProperty("--oriex-home-photo-ov");
      root.style.removeProperty("--oriex-home-photo-pos");
      root.style.removeProperty("--oriex-home-photo-size");
      if(document.body&&document.body.classList)document.body.classList.remove("oxbg-on");
      var offRoot=document.getElementById("root");
      if(offRoot&&offRoot.style){offRoot.style.position="";offRoot.style.zIndex="";}
      removePhotoLayer();
    }
  }
  function apply(){applyRoot();applyPreview();}
  function loadFor(u){cur.uid=u;cur.settings=loadSettings(u);return idbGet(u).then(function(v){releaseObjUrl();cur.photo=v||null;apply();});}
  function refresh(){var u=uid();if(u!==cur.uid){loadFor(u);}}
  try{setInterval(refresh,800);}catch(e){}
  try{if(document.readyState!=="loading")setTimeout(function(){loadFor(uid());},0);else document.addEventListener("DOMContentLoaded",function(){loadFor(uid());});}catch(e){}
  function cssApplied(){var root=document.documentElement;var layer=document.getElementById(PHOTO_LAYER_ID);return !!(cur.photo&&document.body&&document.body.classList&&document.body.classList.contains("oxbg-on")&&root.style.getPropertyValue("--oriex-home-photo-url")&&layer&&layer.style&&layer.style.backgroundImage&&layer.style.zIndex!=="-1");}
  function setPhotoDetailed(blob){
    releaseObjUrl();cur.photo=blob||null;var u=uid();
    if(cur.photo){
      return idbPut(u,cur.photo).then(function(){
        return idbGet(u).then(function(saved){
          if(saved){releaseObjUrl();cur.photo=saved;}
          apply();
          return {ok:!!saved,saveOk:true,readOk:!!saved,cssOk:cssApplied()};
        }).catch(function(){
          apply();
          return {ok:false,saveOk:true,readOk:false,cssOk:cssApplied()};
        });
      }).catch(function(){
        apply();
        return {ok:false,saveOk:false,readOk:false,cssOk:cssApplied()};
      });
    }
    return idbDel(u).then(function(ok){
      releaseObjUrl();cur.photo=null;apply();
      return {ok:!!ok,deleteOk:!!ok,cssOk:!document.body.classList.contains("oxbg-on")};
    }).catch(function(){
      releaseObjUrl();cur.photo=null;apply();
      return {ok:false,deleteOk:false,cssOk:!document.body.classList.contains("oxbg-on")};
    });
  }
  function statusSummary(d){
    if(d.deleteOk!=null)return "削除"+(d.deleteOk?"OK":"NG")+" / CSS解除"+(d.cssOk?"OK":"NG");
    return "保存"+(d.saveOk?"OK":"NG")+" / 読み出し"+(d.readOk?"OK":"NG")+" / CSS反映"+(d.cssOk?"OK":"NG");
  }
  function setPhoto(blob){return setPhotoDetailed(blob).then(function(d){return !!(d&&d.ok&&d.cssOk);});}
  function clearPhoto(){return setPhoto(null);}
  function setSettings(part){cur.settings=Object.assign({},cur.settings,part||{});saveSettings(uid(),cur.settings);apply();}
  function resetDefault(){cur.settings={scale:1,x:50,y:50,opacity:1};saveSettings(uid(),cur.settings);return clearPhoto();}
  function openSettings(){
    if(document.getElementById("oxbg-modal"))return;
    var s=cur.settings;
    var wrap=document.createElement("div");wrap.id="oxbg-modal";
    wrap.style.cssText="position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.42)";
    var card=document.createElement("div");
    card.style.cssText="width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 22px);box-shadow:0 -8px 30px rgba(0,0,0,.2);font-family:'Zen Maru Gothic','Zen Kaku Gothic New',sans-serif;color:#222";
    function row(label,el){var d=document.createElement("div");d.style.cssText="margin:12px 0";var l=document.createElement("div");l.textContent=label;l.style.cssText="font-size:12.5px;font-weight:800;color:#666;margin-bottom:6px";d.appendChild(l);d.appendChild(el);return d;}
    function slider(min,max,step,val,oninput){var i=document.createElement("input");i.type="range";i.min=min;i.max=max;i.step=step;i.value=val;i.style.cssText="width:100%;accent-color:#0891b2";i.oninput=function(){oninput(parseFloat(i.value));};return i;}
    var title=document.createElement("div");title.textContent="\u30C6\u30FC\u30DE\u80CC\u666F\uFF08\u30A2\u30D7\u30EA\u5168\u4F53\uFF09";title.style.cssText="font-size:18px;font-weight:900;margin-bottom:4px";
    var hint=document.createElement("div");hint.textContent="アプリ全体の背景です。写真はこの端末内に保存され、外部には送信されません。";hint.style.cssText="font-size:11.5px;color:#999;margin-bottom:8px";
    pv=document.createElement("div");pv.style.cssText="width:140px;height:248px;margin:2px auto;border-radius:20px;border:1px solid #e6e6e6;background:#0891b2;background-repeat:no-repeat;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;overflow:hidden";
    var statusEl=document.createElement("div");statusEl.style.cssText="margin:8px 0 0;font-size:12px;font-weight:700;line-height:1.5;display:none";
    function setStatus(msg,kind){if(!statusEl)return;if(!msg){statusEl.style.display="none";statusEl.textContent="";return;}statusEl.style.display="block";statusEl.textContent=msg;statusEl.style.color=(kind==="err")?"#c0392b":(kind==="ok")?"#15803d":"#666";}
    var file=document.createElement("input");file.type="file";file.accept="image/*";file.style.cssText="display:none";
    file.onchange=function(){
      var f=file.files&&file.files[0];
      if(!f){return;}
      setStatus("画像を処理しています…","");
      compressImageToBlob(f,{}).then(function(out){
        return setPhotoDetailed(out.blob).then(function(d){
          var msg=(out.resized?"画像が大きいため、圧縮して保存しました。":"保存しました。")+" "+statusSummary(d);
          setStatus(msg,d&&d.ok&&d.cssOk?"ok":"err");
        });
      }).catch(function(){
        setStatus("画像を読み込めませんでした。別の写真を選んでください。","err");
      }).then(function(){try{file.value="";}catch(e){}});
    };
    function btn(txt,bg,fg,cb){var b=document.createElement("button");b.textContent=txt;b.style.cssText="flex:1;min-width:0;padding:12px 10px;border-radius:14px;border:none;font-weight:800;font-size:13.5px;cursor:pointer;background:"+bg+";color:"+fg+";font-family:inherit";b.onclick=cb;return b;}
    var brow=document.createElement("div");brow.style.cssText="display:flex;gap:8px;margin:10px 0 4px";
    brow.appendChild(btn("\u5199\u771F\u3092\u9078\u629E","#0891b2","#fff",function(){file.click();}));
    brow.appendChild(btn("\u524A\u9664","#fde8e8","#c0392b",function(){setPhotoDetailed(null).then(function(d){setStatus("写真を削除しました。 "+statusSummary(d),d&&d.cssOk?"ok":"err");});}));
    brow.appendChild(btn("\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3059","#eef2f4","#445",function(){cur.settings={scale:1,x:50,y:50,opacity:1};saveSettings(uid(),cur.settings);syncInputs();setPhotoDetailed(null).then(function(d){setStatus("デフォルトに戻しました。 "+statusSummary(d),d&&d.cssOk?"ok":"err");});}));
    var sc=slider(0.5,3,0.02,s.scale||1,function(v){setSettings({scale:v});});
    var sx=slider(0,100,1,s.x==null?50:s.x,function(v){setSettings({x:v});});
    var sy=slider(0,100,1,s.y==null?50:s.y,function(v){setSettings({y:v});});
    var so=slider(0.3,1,0.02,s.opacity==null?1:s.opacity,function(v){setSettings({opacity:v});});
    function syncInputs(){var c=cur.settings;sc.value=c.scale;sx.value=c.x;sy.value=c.y;so.value=c.opacity;}
    var done=btn("\u5B8C\u4E86","#222","#fff",function(){pv=null;document.body.removeChild(wrap);});done.style.marginTop="10px";done.style.width="100%";done.style.flex="none";
    card.appendChild(title);card.appendChild(hint);card.appendChild(pv);card.appendChild(file);card.appendChild(brow);card.appendChild(statusEl);
    card.appendChild(row("\u62E1\u5927\u7387",sc));card.appendChild(row("\u6C34\u5E73\u4F4D\u7F6E",sx));card.appendChild(row("\u5782\u76F4\u4F4D\u7F6E",sy));card.appendChild(row("\u4E0D\u900F\u660E\u5EA6",so));
    card.appendChild(done);
    wrap.appendChild(card);
    wrap.onclick=function(ev){if(ev.target===wrap){pv=null;document.body.removeChild(wrap);}};
    document.body.appendChild(wrap);
    applyPreview();
  }
  return {openSettings:openSettings,setPhoto:setPhoto,clearPhoto:clearPhoto,setSettings:setSettings,resetDefault:resetDefault,refresh:refresh,isOn:function(){return !!cur.photo;},afterTheme:applyRoot,_cur:cur};
})();
window.__oxPbg=(function(){
  function uid(){return window.__oxUid||"local";}
  function sKey(u){return "oriex_profile_bg_settings_"+(u||"local");}
  var cur={uid:null,settings:{scale:1,x:50,y:50}};
  function load(u){try{var s=JSON.parse(localStorage.getItem(sKey(u))||"null");if(s&&typeof s==="object")return{scale:+s.scale||1,x:s.x==null?50:+s.x,y:s.y==null?50:+s.y};}catch(e){}return{scale:1,x:50,y:50};}
  function save(u,s){try{localStorage.setItem(sKey(u),JSON.stringify(s));}catch(e){}}
  function sizeStr(){return (100*(cur.settings.scale||1))+"%";}
  function posStr(){return cur.settings.x+"% "+cur.settings.y+"%";}
  window.__oxPbgSize=function(){return sizeStr();};
  window.__oxPbgPos=function(){return posStr();};
  function applyEls(){try{var els=document.querySelectorAll("[data-oxpbg-cover]");for(var i=0;i<els.length;i++){els[i].style.backgroundSize=sizeStr();els[i].style.backgroundPosition=posStr();}}catch(e){}}
  var pv,pvUrl;
  function applyPreview(){if(!pv)return;if(pvUrl){pv.style.backgroundImage="url('"+pvUrl+"')";pv.style.backgroundSize=sizeStr();pv.style.backgroundPosition=posStr();pv.textContent="";}else{pv.style.backgroundImage="none";pv.textContent="\u5199\u771F\u306A\u3057";}}
  function refresh(){var u=uid();if(u!==cur.uid){cur.uid=u;cur.settings=load(u);applyEls();}}
  try{setInterval(refresh,800);}catch(e){}
  try{setTimeout(function(){cur.uid=uid();cur.settings=load(cur.uid);applyEls();},0);}catch(e){}
  function setSettings(part){cur.settings=Object.assign({},cur.settings,part||{});save(uid(),cur.settings);applyEls();applyPreview();}
  function resetDefault(){cur.settings={scale:1,x:50,y:50};save(uid(),cur.settings);applyEls();applyPreview();}
  function openSettings(coverUrl){
    if(document.getElementById("oxpbg-modal"))return;
    cur.uid=uid();cur.settings=load(cur.uid);pvUrl=coverUrl||null;
    var s=cur.settings;
    var wrap=document.createElement("div");wrap.id="oxpbg-modal";
    wrap.style.cssText="position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.42)";
    var card=document.createElement("div");
    card.style.cssText="width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 22px);box-shadow:0 -8px 30px rgba(0,0,0,.2);font-family:'Zen Maru Gothic','Zen Kaku Gothic New',sans-serif;color:#222";
    function row(label,el){var d=document.createElement("div");d.style.cssText="margin:12px 0";var l=document.createElement("div");l.textContent=label;l.style.cssText="font-size:12.5px;font-weight:800;color:#666;margin-bottom:6px";d.appendChild(l);d.appendChild(el);return d;}
    function slider(min,max,step,val,oninput){var i=document.createElement("input");i.type="range";i.min=min;i.max=max;i.step=step;i.value=val;i.style.cssText="width:100%;accent-color:#7c3aed";i.oninput=function(){oninput(parseFloat(i.value));};return i;}
    var title=document.createElement("div");title.textContent="\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u80CC\u666F\u306E\u8ABF\u6574";title.style.cssText="font-size:18px;font-weight:900;margin-bottom:4px";
    var hint=document.createElement("div");hint.textContent="\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u30AB\u30FC\u30C9\u306E\u80CC\u666F\u5199\u771F\u306E\u898B\u3048\u65B9\u3092\u8ABF\u6574\u3057\u307E\u3059\u3002";hint.style.cssText="font-size:11.5px;color:#999;margin-bottom:8px";
    pv=document.createElement("div");pv.style.cssText="width:100%;height:120px;border-radius:14px;border:1px solid #e6e6e6;background:#7c3aed no-repeat center;background-size:cover;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;overflow:hidden";
    function btn(txt,bg,fg,cb){var b=document.createElement("button");b.textContent=txt;b.style.cssText="flex:1;min-width:0;padding:12px 10px;border-radius:14px;border:none;font-weight:800;font-size:13.5px;cursor:pointer;background:"+bg+";color:"+fg+";font-family:inherit";b.onclick=cb;return b;}
    var sc=slider(0.5,3,0.02,s.scale||1,function(v){setSettings({scale:v});});
    var sx=slider(0,100,1,s.x==null?50:s.x,function(v){setSettings({x:v});});
    var sy=slider(0,100,1,s.y==null?50:s.y,function(v){setSettings({y:v});});
    function syncInputs(){var c=cur.settings;sc.value=c.scale;sx.value=c.x;sy.value=c.y;}
    var brow=document.createElement("div");brow.style.cssText="display:flex;gap:8px;margin:10px 0 4px";
    brow.appendChild(btn("\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3059","#eef2f4","#445",function(){resetDefault();syncInputs();}));
    var done=btn("\u5B8C\u4E86","#222","#fff",function(){pv=null;document.body.removeChild(wrap);});done.style.marginTop="10px";done.style.width="100%";done.style.flex="none";
    card.appendChild(title);card.appendChild(hint);card.appendChild(pv);card.appendChild(brow);
    card.appendChild(row("\u62E1\u5927\u7387",sc));card.appendChild(row("\u6C34\u5E73\u4F4D\u7F6E",sx));card.appendChild(row("\u5782\u76F4\u4F4D\u7F6E",sy));
    card.appendChild(done);
    wrap.appendChild(card);
    wrap.onclick=function(ev){if(ev.target===wrap){pv=null;document.body.removeChild(wrap);}};
    document.body.appendChild(wrap);
    applyPreview();
  }
  return {openSettings:openSettings,setSettings:setSettings,resetDefault:resetDefault,refresh:refresh,size:sizeStr,pos:posStr,_cur:cur};
})();
window.__oxAv=(function(){
  function uid(){return window.__oxUid||"local";}
  function sKey(u){return "oriex_avatar_settings_"+(u||"local");}
  var cur={uid:null,settings:{scale:1,x:50,y:50}};
  function load(u){try{var s=JSON.parse(localStorage.getItem(sKey(u))||"null");if(s&&typeof s==="object")return{scale:+s.scale||1,x:s.x==null?50:+s.x,y:s.y==null?50:+s.y};}catch(e){}return{scale:1,x:50,y:50};}
  function save(u,s){try{localStorage.setItem(sKey(u),JSON.stringify(s));}catch(e){}}
  function posStr(){return cur.settings.x+"% "+cur.settings.y+"%";}
  function scaleStr(){return "scale("+(cur.settings.scale||1)+")";}
  window.__oxAvPos=function(){return posStr();};
  window.__oxAvScale=function(){return scaleStr();};
  function applyEls(){try{var els=document.querySelectorAll("[data-oxav]");for(var i=0;i<els.length;i++){els[i].style.objectPosition=posStr();els[i].style.transform=scaleStr();els[i].style.transformOrigin=posStr();}}catch(e){}}
  var pv,pvUrl;
  function applyPreview(){if(!pv)return;if(pvUrl){pv.style.backgroundImage="url('"+pvUrl+"')";pv.style.backgroundSize=(100*(cur.settings.scale||1))+"%";pv.style.backgroundPosition=posStr();pv.textContent="";}else{pv.style.backgroundImage="none";pv.textContent="\u5199\u771F\u306A\u3057";}}
  function refresh(){var u=uid();if(u!==cur.uid){cur.uid=u;cur.settings=load(u);applyEls();}}
  try{setInterval(refresh,800);}catch(e){}
  try{setTimeout(function(){cur.uid=uid();cur.settings=load(cur.uid);applyEls();},0);}catch(e){}
  function setSettings(part){cur.settings=Object.assign({},cur.settings,part||{});save(uid(),cur.settings);applyEls();applyPreview();}
  function resetDefault(){cur.settings={scale:1,x:50,y:50};save(uid(),cur.settings);applyEls();applyPreview();}
  function openSettings(url){
    if(document.getElementById("oxav-modal"))return;
    cur.uid=uid();cur.settings=load(cur.uid);pvUrl=url||null;var s=cur.settings;
    var wrap=document.createElement("div");wrap.id="oxav-modal";
    wrap.style.cssText="position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.42)";
    var card=document.createElement("div");
    card.style.cssText="width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 22px);box-shadow:0 -8px 30px rgba(0,0,0,.2);font-family:'Zen Maru Gothic','Zen Kaku Gothic New',sans-serif;color:#222";
    function row(label,el){var d=document.createElement("div");d.style.cssText="margin:12px 0";var l=document.createElement("div");l.textContent=label;l.style.cssText="font-size:12.5px;font-weight:800;color:#666;margin-bottom:6px";d.appendChild(l);d.appendChild(el);return d;}
    function slider(min,max,step,val,oninput){var i=document.createElement("input");i.type="range";i.min=min;i.max=max;i.step=step;i.value=val;i.style.cssText="width:100%;accent-color:#0891b2";i.oninput=function(){oninput(parseFloat(i.value));};return i;}
    var title=document.createElement("div");title.textContent="\u30A2\u30A4\u30B3\u30F3\u306E\u8ABF\u6574";title.style.cssText="font-size:18px;font-weight:900;margin-bottom:6px";
    pv=document.createElement("div");pv.style.cssText="width:120px;height:120px;border-radius:50%;border:1px solid #e6e6e6;margin:4px auto;background:#0891b2;background-repeat:no-repeat;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;overflow:hidden";
    function btn(txt,bg,fg,cb){var b=document.createElement("button");b.textContent=txt;b.style.cssText="width:100%;padding:12px 10px;border-radius:14px;border:none;font-weight:800;font-size:13.5px;cursor:pointer;background:"+bg+";color:"+fg+";font-family:inherit;margin-top:6px";b.onclick=cb;return b;}
    var sc=slider(0.5,3,0.02,s.scale||1,function(v){setSettings({scale:v});});
    var sx=slider(0,100,1,s.x==null?50:s.x,function(v){setSettings({x:v});});
    var sy=slider(0,100,1,s.y==null?50:s.y,function(v){setSettings({y:v});});
    function sync(){var c=cur.settings;sc.value=c.scale;sx.value=c.x;sy.value=c.y;}
    card.appendChild(title);card.appendChild(pv);
    card.appendChild(row("\u62E1\u5927\u7387",sc));card.appendChild(row("\u6C34\u5E73\u4F4D\u7F6E",sx));card.appendChild(row("\u5782\u76F4\u4F4D\u7F6E",sy));
    card.appendChild(btn("\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3059","#eef2f4","#445",function(){resetDefault();sync();}));
    card.appendChild(btn("\u5B8C\u4E86","#222","#fff",function(){pv=null;document.body.removeChild(wrap);}));
    wrap.appendChild(card);
    wrap.onclick=function(ev){if(ev.target===wrap){pv=null;document.body.removeChild(wrap);}};
    document.body.appendChild(wrap);
    applyPreview();
  }
  return {openSettings:openSettings,setSettings:setSettings,resetDefault:resetDefault,refresh:refresh,_cur:cur};
})();

window.__oxSubjectCards=(function(){
  var SUBJECT_CARD_LABELS=["英単語","熟語","漢字","化学","古文"];
  var SUBJECT_CARD_COLORS={
    "英単語":{accent:"#0891b2",soft:"#e5f6fb"},
    "熟語":{accent:"#7c3aed",soft:"#f0e9ff"},
    "漢字":{accent:"#dc2626",soft:"#fee2e2"},
    "化学":{accent:"#059669",soft:"#e0f6ee"},
    "古文":{accent:"#b45309",soft:"#fff0dc"}
  };
  function directSpans(btn){
    var out=[];
    for(var i=0;i<btn.children.length;i++){
      if(btn.children[i]&&btn.children[i].tagName==="SPAN")out.push(btn.children[i]);
    }
    return out;
  }
  function labelOf(btn){
    var spans=directSpans(btn);
    if(spans.length<3)return null;
    if(!spans[0].querySelector("svg"))return null;
    if((spans[2].textContent||"").trim()!=="")return null;
    var label=(spans[1].textContent||"").trim();
    return SUBJECT_CARD_LABELS.indexOf(label)>=0?label:null;
  }
  function isSelected(btn){
    var spans=directSpans(btn);
    var underline=spans[2];
    var w=parseFloat((underline&&underline.style&&underline.style.width)||"0");
    var border=(btn.style&&btn.style.border)||"";
    return w>=16||border.indexOf("1.5px")>=0;
  }
  function annotate(){
    try{
      var buttons=document.querySelectorAll("button");
      for(var i=0;i<buttons.length;i++){
        var btn=buttons[i],label=labelOf(btn);
        if(label){
          var c=SUBJECT_CARD_COLORS[label];
          btn.setAttribute("data-ox-subject-card",label);
          btn.setAttribute("data-ox-subject-selected",isSelected(btn)?"true":"false");
          btn.style.setProperty("--ox-subject-accent",c.accent);
          btn.style.setProperty("--ox-subject-soft",c.soft);
        }else if(btn.hasAttribute&&btn.hasAttribute("data-ox-subject-card")){
          btn.removeAttribute("data-ox-subject-card");
          btn.removeAttribute("data-ox-subject-selected");
          btn.style.removeProperty("--ox-subject-accent");
          btn.style.removeProperty("--ox-subject-soft");
        }
      }
    }catch(e){}
  }
  var queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    (window.requestAnimationFrame||setTimeout)(function(){queued=false;annotate();},16);
  }
  try{
    if(document.readyState!=="loading")setTimeout(annotate,0);
    else document.addEventListener("DOMContentLoaded",annotate);
    if(window.MutationObserver){
      new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class"]});
    }
    setInterval(annotate,700);
  }catch(e){}
  return {refresh:annotate,labels:function(){return SUBJECT_CARD_LABELS.slice();}};
})();
window.__oxStudy=function(uid,logs){var PFX="oriex_local_study_minutes_";var want=(uid==null?"local":String(uid));var key=PFX+want;function dkey(d){var t=new Date(d);if(isNaN(t))return"";var i=new Date(t.getTime()+(t.getTimezoneOffset()+540)*6e4);return i.getFullYear()+"/"+(i.getMonth()+1)+"/"+i.getDate();}function ld(l){if(!l)return 0;var t=l.createdAt!=null?l.createdAt:l.studiedAt!=null?l.studiedAt:l.date!=null?l.date:l.timestamp;if(t==null)return 0;if(typeof t=="number")return t;if(typeof t=="string"){var v=Date.parse(t);return isNaN(v)?0:v;}return 0;}var map={};(logs||[]).forEach(function(l){if(!l)return;var lu=(l.uid==null?"local":String(l.uid));if(lu!==want)return;var dk=dkey(ld(l));if(!dk)return;var mn=Number(l.minutes)||0;if(mn<=0)return;map[dk]=(Number(map[dk])||0)+mn;});var empty=true;for(var kk in map){if(Object.prototype.hasOwnProperty.call(map,kk)){empty=false;break;}}if(empty){var stored={};try{var s=localStorage.getItem(key);var o=s?JSON.parse(s):null;if(o&&typeof o=="object")stored=o;}catch(e){}map=stored;}else{try{localStorage.setItem(key,JSON.stringify(map));}catch(e){}}var now=new Date();var todayKey=dkey(now);var today=Number(map[todayKey])||0;var days=[];for(var v=6;v>=0;v--){var d=new Date(now);d.setDate(now.getDate()-v);var k=dkey(d);days.push({k:k,lb:(d.getMonth()+1)+"/"+d.getDate(),m:Number(map[k])||0});}var total=days.reduce(function(a,b){return a+(b.m||0);},0);return{today:today,days:days,total:total,todayKey:todayKey,map:map};};
