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
    var nodes=document.querySelectorAll('div[class*="SearchResult_SearchResult__"], li[class*="LoopList__item"]');
    var list=[];
    var seen={};
    for(var i=0;i<nodes.length;i++){
      var c=nodes[i];
      var linkEl=c.querySelector('a[class*="SearchResultItem__detailLink"], a[href*="store.shopping.yahoo.co.jp"], a[href*="rdUrl="]');
      if(!linkEl){continue;}
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
      var net=Math.max(0,total-pt);

      var oldB=c.querySelector('.ysh-unit-badge');
      if(oldB){oldB.remove();}
      var badge=document.createElement('div');
      badge.className='ysh-unit-badge';
      badge.style.cssText='margin:4px 0;padding:4px 8px;background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;font-size:12px;font-weight:700;color:#92400e;display:inline-block;';
      badge.textContent='単価: '+Math.round(total/q.qty)+'円/'+q.unit+' ('+q.qty+q.unit+'・実質'+Math.round(net/q.qty)+'円)';
      linkEl.parentNode.insertBefore(badge,linkEl.nextSibling);

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
        store:store
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
      '#ysh-unit-q{flex:1;min-width:150px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;}'+
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

  var state={sort:'unit',onlyFree:false,q:''};
  var m=document.createElement('div');
  m.id='ysh-unit-modal';
  m.innerHTML=
    '<div id="ysh-unit-box">'+
      '<div id="ysh-unit-head">'+
        '<div id="ysh-unit-title">Yahoo!ショッピング 単価一覧 ('+items.length+'件)</div>'+
        '<button type="button" id="ysh-close" class="ysh-btn">閉じる</button>'+
      '</div>'+
      '<div id="ysh-unit-ctrl">'+
        '<input id="ysh-unit-q" type="search" placeholder="絞り込み (商品名・ストア)">'+
        '<button type="button" data-sort="unit" class="ysh-btn ysh-btn-active">単価順(送料込)</button>'+
        '<button type="button" data-sort="net" class="ysh-btn">実質単価順</button>'+
        '<button type="button" data-sort="total" class="ysh-btn">総額順</button>'+
        '<button type="button" data-sort="orig" class="ysh-btn">元の順</button>'+
        '<button type="button" id="ysh-free" class="ysh-btn">送料無料のみ</button>'+
      '</div>'+
      '<div id="ysh-unit-body"></div>'+
    '</div>';
  document.body.appendChild(m);

  function render(){
    var body=document.getElementById('ysh-unit-body');
    var arr=items.slice();
    if(state.onlyFree){arr=arr.filter(function(it){return it.ship===0;});}
    if(state.q){
      arr=arr.filter(function(it){
        return (it.title+' '+it.store).toLowerCase().indexOf(state.q)>=0;
      });
    }
    if(state.sort==='unit'){
      arr.sort(function(a,b){return (a.total/a.qty)-(b.total/b.qty)||a.total-b.total;});
    }else if(state.sort==='net'){
      arr.sort(function(a,b){return (a.net/a.qty)-(b.net/b.qty)||a.net-b.net;});
    }else if(state.sort==='total'){
      arr.sort(function(a,b){return a.total-b.total||a.idx-b.idx;});
    }else{
      arr.sort(function(a,b){return a.idx-b.idx;});
    }

    var h='<table class="ysh-tbl"><thead><tr>'+
      '<th>単価</th><th>数量</th><th>総額(送料/Pt)</th><th>商品名・ストア</th><th></th>'+
      '</tr></thead><tbody>';
    for(var i=0;i<arr.length;i++){
      var it=arr[i];
      var u=(it.total/it.qty).toFixed(1).replace(/\.0$/,'');
      var nu=(it.net/it.qty).toFixed(1).replace(/\.0$/,'');
      h+='<tr>'+
        '<td><div class="ysh-u">'+u+'円/'+esc(it.unit)+'</div><div class="ysh-sub">実質 '+nu+'円</div></td>'+
        '<td><input type="number" min="1" class="ysh-qty-in" data-idx="'+it.idx+'" value="'+it.qty+'"><div class="ysh-sub">'+esc(it.rule)+'</div></td>'+
        '<td><div><b>'+it.total.toLocaleString()+'円</b></div><div class="ysh-sub">'+esc(it.shipTxt)+(it.pt?' / -'+it.pt+'pt':'')+'</div></td>'+
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
  document.getElementById('ysh-free').onclick=function(e){
    state.onlyFree=!state.onlyFree;
    e.target.classList.toggle('ysh-btn-active',state.onlyFree);
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
