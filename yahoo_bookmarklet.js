(function(){
  if(!/shopping\.yahoo\.co\.jp/i.test(location.hostname)){
    alert('Yahoo!ショッピングの検索結果ページで実行してください。');
    return;
  }
  var OLD=document.getElementById('ysh-unit-modal');
  if(OLD){OLD.remove();}

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function toHalf(s){
    return String(s||'').replace(/[０-９]/g,function(ch){
      return String.fromCharCode(ch.charCodeAt(0)-0xFEE0);
    }).replace(/✕|✖/g,'×');
  }

  function parseQty(rawTitle){
    var t=toHalf(rawTitle);
    t=t.replace(/[0-9]+(?:\.[0-9]+)?\s*(?:円|％|%|kcal|mg|ml|kg|mm|cm|g|l)(?![a-z])/gi,' ');
    t=t.replace(/1\s*(?:本|個|袋|枚|粒|錠|パック|缶|包)\s*(?:あたり|当たり|につき)/g,' ');

    var mTotal=t.match(/(?:合計|計)\s*([0-9]+)\s*(本|個|袋|枚|錠|粒|パック|缶|包|食|回)/);
    if(mTotal){
      var nT=parseInt(mTotal[1],10);
      if(nT>0){return {qty:nT,unit:mTotal[2],rule:'合計'};}
    }

    var mMul=t.match(/([0-9]+)\s*(本|個|袋|枚|錠|粒|パック|缶|包|食|種)?\s*[×x\*]\s*([0-9]+)\s*(箱|ケース|ボール|セット|パック|袋|本|個)/i);
    if(mMul){
      var a=parseInt(mMul[1],10),b=parseInt(mMul[3],10);
      if(a>0&&b>0&&a*b<=5000){
        return {qty:a*b,unit:mMul[2]||mMul[4],rule:a+'×'+b};
      }
    }

    var mSingle=t.match(/([0-9]+)\s*(本|個|袋|枚|錠|粒|パック|缶|包|食|回)(?:入|セット|詰|組)?/);
    if(mSingle){
      var nS=parseInt(mSingle[1],10);
      if(nS>0){return {qty:nS,unit:mSingle[2],rule:'単体'};}
    }

    return {qty:1,unit:'個',rule:'不明(1)'};
  }

  function parseCards(){
    var links=document.querySelectorAll('a[class*="SearchResultItem__detailLink"]');
    var list=[];
    var seen={};
    if(links.length){
      for(var i=0;i<links.length;i++){
        var linkEl=links[i];
        var c=linkEl.parentElement;
        for(var up=0;up<4&&c;up++){
          if(c.querySelector('[class*="ItemPrice_ItemPrice__"], [class*="SearchResultItem__price"]')){break;}
          c=c.parentElement;
        }
        if(!c){continue;}
        var title=(linkEl.innerText||'').replace(/\s+/g,' ').trim();
        if(!title||title.length<3){continue;}
        var href=linkEl.getAttribute('href')||'';
        if(!href||seen[href+'|'+title]){continue;}
        seen[href+'|'+title]=true;

        var priceEl=c.querySelector('[class*="ItemPrice_ItemPrice__"], [class*="SearchResultItem__price"]');
        var priceTxt=priceEl?(priceEl.innerText||''):(c.innerText||'');
        var pm=priceTxt.replace(/,/g,'').match(/([0-9]+)\s*円/);
        if(!pm){continue;}
        var price=parseInt(pm[1],10);

        var shipEl=c.querySelector('[class*="ItemPostage_ItemPostage__"]');
        var shipTxt=shipEl?(shipEl.innerText||'').replace(/\s+/g,' ').trim():'';
        var ship=0;
        if(shipTxt&&!/無料/.test(shipTxt)){
          var sm=shipTxt.replace(/,/g,'').match(/([0-9]+)\s*円/);
          if(sm){ship=parseInt(sm[1],10);}
        }

        var ptEl=c.querySelector('[class*="SearchResultItem__point"]');
        var ptTxt=ptEl?(ptEl.innerText||'').replace(/\s+/g,' ').trim():'';
        var pt=0;
        var ptm=ptTxt.replace(/,/g,'').match(/([0-9]+)\s*pt/i);
        if(ptm){pt=parseInt(ptm[1],10);}

        var stEl=c.querySelector('[class*="SearchResultItem__store"]');
        var store=stEl?(stEl.innerText||'').replace(/\s+/g,' ').trim():'';

        var q=parseQty(title);
        var total=price+ship;
        var net=Math.max(0,price+ship-pt);
        var prEl=c.querySelector('[class*="Ad"], [class*="Sponsor"], [data-is-ad]');
        var isPr=/^\[PR\]/i.test(title)||!!prEl||/(?:^|\s)(?:PR|広告)(?:\s|$)/.test(c.innerText||'');

        var oldB=c.querySelector('.ysh-unit-badge');
        if(oldB){oldB.remove();}
        if(!isPr){
          var badge=document.createElement('div');
          badge.className='ysh-unit-badge';
          badge.style.cssText='margin:4px 0;padding:4px 8px;background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;font-size:12px;font-weight:700;color:#92400e;display:inline-block;';
          badge.textContent='1'+q.unit+': '+Math.round(price/q.qty)+'円 (実質'+Math.round(net/q.qty)+'円・'+q.qty+q.unit+')';
          linkEl.parentNode.insertBefore(badge,linkEl.nextSibling);
        }

        list.push({
          idx:list.length,
          title:title,
          href:href,
          price:price,
          ship:ship,
          shipTxt:shipTxt||(ship===0?'送料無料':'+送料'+ship+'円'),
          pt:pt,
          total:total,
          net:net,
          qty:q.qty,
          unit:q.unit,
          rule:q.rule,
          store:store,
          isPr:isPr
        });
      }
      return list;
    }

    var nodes=document.querySelectorAll('li[class*="LoopList__item"]');
    for(var j=0;j<nodes.length;j++){
      var c2=nodes[j];
      var link2=c2.querySelector('a[href*="store.shopping.yahoo.co.jp"], a[href*="rdUrl="]');
      if(!link2){continue;}
      var title2=(link2.innerText||'').replace(/\s+/g,' ').trim();
      if(!title2||title2.length<3){continue;}
      var href2=link2.getAttribute('href')||'';
      if(!href2||seen[href2+'|'+title2]){continue;}
      seen[href2+'|'+title2]=true;
      var pm2=(c2.innerText||'').replace(/,/g,'').match(/([0-9]+)\s*円/);
      if(!pm2){continue;}
      var price2=parseInt(pm2[1],10);
      var q2=parseQty(title2);
      list.push({
        idx:list.length,title:title2,href:href2,price:price2,ship:0,shipTxt:'',pt:0,total:price2,net:price2,qty:q2.qty,unit:q2.unit,rule:q2.rule,store:''
      });
    }
    return list;
  }

  var items=parseCards();
  if(!items.length){
    alert('商品が見つかりませんでした。検索結果を表示した状態で実行してください。');
    return;
  }

  var stEl=document.getElementById('ysh-unit-style');
  if(!stEl){
    stEl=document.createElement('style');
    stEl.id='ysh-unit-style';
    stEl.textContent=
      '#ysh-unit-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;-webkit-text-size-adjust:100%;}'+
      '#ysh-unit-box{background:#fff;color:#111;width:100%;max-width:1020px;height:90vh;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);}'+
      '#ysh-unit-head{background:#ff0033;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;justify-content:space-between;}'+
      '#ysh-unit-title{font-size:15px;font-weight:700;flex:1;}'+
      '.ysh-btn{border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;background:#e2e8f0;color:#1e293b;white-space:nowrap;}'+
      '.ysh-btn-active{background:#0f172a;color:#fff;}'+
      '#ysh-unit-ctrl{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}'+
      '#ysh-unit-q{flex:1;min-width:160px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;}'+
      '#ysh-price-range{width:130px;padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;}'+
      '#ysh-price-target{padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;}'+
      '#ysh-unit-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 12px 16px;}'+
      '.ysh-tbl{width:100%;border-collapse:collapse;font-size:13px;}'+
      '.ysh-tbl th{position:sticky;top:0;background:#f1f5f9;text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#475569;z-index:1;}'+
      '.ysh-tbl td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;}'+
      '.ysh-u{font-size:15px;font-weight:700;color:#b91c1c;white-space:nowrap;}'+
      '.ysh-sub{font-size:12px;color:#475569;white-space:nowrap;}'+
      '.ysh-qty-in{width:56px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;text-align:right;}'+
      '.ysh-open{display:inline-block;padding:6px 10px;background:#ff0033;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;}';
    document.head.appendChild(stEl);
  }

  var state={sort:'orig',dir:1,onlyFree:false,noPr:true,q:'',priceRange:'',priceTarget:'net'};
  var m=document.createElement('div');
  m.id='ysh-unit-modal';
  m.innerHTML=
    '<div id="ysh-unit-box">'+
      '<div id="ysh-unit-head">'+
        '<div id="ysh-unit-title">Yahoo!ショッピング 単価一覧 v1.7 ('+items.length+'件)</div>'+
        '<button type="button" id="ysh-close" class="ysh-btn">閉じる</button>'+
      '</div>'+
      '<div id="ysh-unit-ctrl">'+
        '<input id="ysh-unit-q" type="search" placeholder="絞り込み (例: 24本 -訳あり)">'+
        '<select id="ysh-price-target"><option value="net">実質価格</option><option value="price">商品価格</option></select>'+
        '<input id="ysh-price-range" type="text" placeholder="例: 1-99999">'+
        '<button type="button" data-sort="net_unit" class="ysh-btn">1個(実質)</button>'+
        '<button type="button" data-sort="unit" class="ysh-btn">1個</button>'+
        '<button type="button" data-sort="net" class="ysh-btn">実質価格</button>'+
        '<button type="button" data-sort="price" class="ysh-btn">商品価格</button>'+
        '<button type="button" data-sort="orig" class="ysh-btn ysh-btn-active">元の順</button>'+
        '<button type="button" id="ysh-dir" class="ysh-btn ysh-btn-active">昇順▲</button>'+
        '<button type="button" id="ysh-free" class="ysh-btn">送料無料のみ</button>'+
        '<button type="button" id="ysh-nopr" class="ysh-btn ysh-btn-active">PR除外</button>'+
      '</div>'+
      '<div id="ysh-unit-body"></div>'+
    '</div>';
  document.body.appendChild(m);

  function parseRange(str){
    var s=toHalf(str||'').replace(/,/g,'').trim();
    if(!s){return null;}
    var mR=s.match(/^([0-9]+)?\s*[-~〜]\s*([0-9]+)?$/);
    if(mR){
      var mn=mR[1]?parseInt(mR[1],10):0;
      var mx=mR[2]?parseInt(mR[2],10):Infinity;
      return {min:mn,max:mx};
    }
    var mOne=s.match(/^[0-9]+$/);
    if(mOne){
      var v=parseInt(mOne[0],10);
      return {min:v,max:v};
    }
    return null;
  }

  function render(){
    var body=document.getElementById('ysh-unit-body');
    var arr=items.slice();
    if(state.noPr){arr=arr.filter(function(it){return !it.isPr;});}
    if(state.onlyFree){arr=arr.filter(function(it){return it.ship===0;});}
    if(state.q){
      var tokens=state.q.split(/\s+/).filter(Boolean);
      arr=arr.filter(function(it){
        var hay=it.title.toLowerCase();
        for(var t=0;t<tokens.length;t++){
          var tok=tokens[t];
          if(tok.charAt(0)==='-'&&tok.length>1){
            if(hay.indexOf(tok.slice(1))>=0){return false;}
          }else{
            if(hay.indexOf(tok)<0){return false;}
          }
        }
        return true;
      });
    }
    var rg=parseRange(state.priceRange);
    if(rg){
      arr=arr.filter(function(it){
        var val=state.priceTarget==='price'?it.price:it.net;
        return val>=rg.min&&val<=rg.max;
      });
    }
    var d=state.dir;
    if(state.sort==='net_unit'){
      arr.sort(function(a,b){return d*((a.net/a.qty)-(b.net/b.qty))||d*(a.net-b.net);});
    }else if(state.sort==='unit'){
      arr.sort(function(a,b){return d*((a.price/a.qty)-(b.price/b.qty))||d*(a.price-b.price);});
    }else if(state.sort==='net'){
      arr.sort(function(a,b){return d*(a.net-b.net)||a.idx-b.idx;});
    }else if(state.sort==='price'){
      arr.sort(function(a,b){return d*(a.price-b.price)||a.idx-b.idx;});
    }else{
      arr.sort(function(a,b){return d*(a.idx-b.idx);});
    }

    var titleEl=document.getElementById('ysh-unit-title');
    if(titleEl){titleEl.textContent='Yahoo!ショッピング 単価一覧 v1.6 ('+arr.length+'/'+items.length+'件)';}

    var h='<table class="ysh-tbl"><thead><tr>'+
      '<th>1個 / 1個(実質)</th><th>数量</th><th>商品価格 / 実質価格</th><th>商品名・ストア</th><th></th>'+
      '</tr></thead><tbody>';
    for(var i=0;i<arr.length;i++){
      var it=arr[i];
      var u=(it.price/it.qty).toFixed(1).replace(/\.0$/,'');
      var nu=(it.net/it.qty).toFixed(1).replace(/\.0$/,'');
      h+='<tr>'+
        '<td><div class="ysh-u">実質 '+nu+'円/'+esc(it.unit)+'</div><div class="ysh-sub">1個 '+u+'円</div></td>'+
        '<td><input type="number" min="1" class="ysh-qty-in" data-idx="'+it.idx+'" value="'+it.qty+'"><div class="ysh-sub">'+esc(it.rule)+'</div></td>'+
        '<td><div><b>実質 '+it.net.toLocaleString()+'円</b></div><div class="ysh-sub">商品 '+it.price.toLocaleString()+'円 / '+esc(it.shipTxt)+(it.pt?' / -'+it.pt+'pt':'')+'</div></td>'+
        '<td><div>'+esc(it.title)+'</div><div class="ysh-sub">'+esc(it.store)+'</div></td>'+
        '<td><a class="ysh-open" href="'+esc(it.href)+'" target="_blank" rel="noopener">開く</a></td>'+
      '</tr>';
    }
    h+='</tbody></table>';
    body.innerHTML=h;

    var qIns=body.querySelectorAll('.ysh-qty-in');
    for(var k=0;k<qIns.length;k++){
      qIns[k].onchange=function(e){
        var idx=parseInt(e.target.getAttribute('data-idx'),10);
        var val=parseInt(e.target.value,10);
        if(val>0){
          for(var z=0;z<items.length;z++){
            if(items[z].idx===idx){items[z].qty=val;items[z].rule='手動';break;}
          }
          render();
        }
      };
    }
  }

  document.getElementById('ysh-close').onclick=function(){m.remove();};
  document.getElementById('ysh-unit-q').oninput=function(e){state.q=e.target.value.trim().toLowerCase();render();};
  document.getElementById('ysh-price-range').oninput=function(e){state.priceRange=e.target.value;render();};
  document.getElementById('ysh-price-target').onchange=function(e){state.priceTarget=e.target.value;render();};
  document.getElementById('ysh-dir').onclick=function(e){
    state.dir*=-1;
    e.target.textContent=state.dir===1?'昇順▲':'降順▼';
    render();
  };
  document.getElementById('ysh-free').onclick=function(e){
    state.onlyFree=!state.onlyFree;
    e.target.classList.toggle('ysh-btn-active',state.onlyFree);
    render();
  };
  document.getElementById('ysh-nopr').onclick=function(e){
    state.noPr=!state.noPr;
    e.target.classList.toggle('ysh-btn-active',state.noPr);
    render();
  };
  var sBtns=m.querySelectorAll('[data-sort]');
  for(var i=0;i<sBtns.length;i++){
    sBtns[i].onclick=function(e){
      state.sort=e.target.getAttribute('data-sort');
      for(var j=0;j<sBtns.length;j++){sBtns[j].classList.remove('ysh-btn-active');}
      e.target.classList.add('ysh-btn-active');
      render();
    };
  }
  render();
})();
