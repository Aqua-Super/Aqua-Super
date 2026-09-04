(function(){
  function esc(s){return String(s||"").replace(/[&<>\"]/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",\"":"&quot;"}[c]);});}
  function install(){
    var main=document.getElementById("main"); if(!main)return;
    var heading=Array.prototype.find.call(main.querySelectorAll("h2,h3,div,p"),function(el){return /All Customers/i.test((el.textContent||"").trim())});
    if(!heading)return;
    var existing=document.getElementById("aquaPwaNotesSearch");
    if(!existing){
      var box=document.createElement("input");
      box.id="aquaPwaNotesSearch"; box.type="search"; box.placeholder="🔎 Customer name ya mobile number search karein...";
      box.autocomplete="off";
      box.style.cssText="display:block;width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;background:#fff;margin:0 0 12px";
      heading.parentNode.insertBefore(box,heading);
      box.addEventListener("input",filter);
    }
    filter();
  }
  function filter(){
    var box=document.getElementById("aquaPwaNotesSearch"); if(!box)return;
    var q=(box.value||"").trim().toLowerCase();
    var cards=document.querySelectorAll(".aqua-note-customer");
    cards.forEach(function(card){card.style.display=(!q||(card.textContent||"").toLowerCase().indexOf(q)>=0)?"":"none";});
  }
  var mo=new MutationObserver(function(){install();});
  document.addEventListener("DOMContentLoaded",function(){install();mo.observe(document.getElementById("main")||document.body,{childList:true,subtree:true});});
})();