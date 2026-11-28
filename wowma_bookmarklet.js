(function(){
  if(!/wowma\.jp/i.test(location.hostname)){
    alert('au PAY マーケットの検索結果ページで実行してください。');
    return;
  }
  var OLD=document.getElementById('wow-unit-modal');
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
    var cards=document.querySelectorAll('[class*="WideListCard_itemCard__"], [class*="ItemCard_itemCard__"]');
    var list=[];
    var seen={};
    for(var i=0;i<cards.length;i++){
      var c=cards[i];
      var linkEl=c.querySelector('a[href*="/item/"]');
      if(!linkEl){continue;}
      var titleEl=c.querySelector('[class*="itemName_title"], h2, h3');
      var title=(titleEl?(titleEl.innerText||''):(linkEl.innerText||'')).replace(/\s+/g,' ').trim();
      if(!title||title.length<3){continue;}
      var href=linkEl.getAttribute('href')||'';
      if(!href||seen[href+'|'+title]){continue;}
      seen[href+'|'+title]=true;

      var priceEl=c.querySelector('[class*="Price_price__sale__"], [class*="Price_price__normal__"]');
      var priceTxt=priceEl?(priceEl.innerText||''):'';
      var pm=priceTxt.replace(/,/g,'').match(/([0-9]+)/);
      if(!pm){continue;}
      var price=parseInt(pm[1],10);

      var shipFreeEl=c.querySelector('[class*="ShipFee_freeShipping"]');
      var shipFeeEl=c.querySelector('[class*="ShipFee_shippingFee"]');
      var ship=0;
      var shipTxt='送料無料';
      if(shipFeeEl){
        var st=(shipFeeEl.innerText||'').replace(/\s+/g,' ').trim();
        shipTxt=st||'送料別';
        var sm=st.replace(/,/g,'').match(/([0-9]+)\s*円/);
        if(sm){ship=parseInt(sm[1],10);}
      }else if(shipFreeEl){
        ship=0;
        shipTxt=(shipFreeEl.innerText||'').replace(/\s+/g,' ').trim()||'送料無料';
      }

      var ptEl=c.querySelector('[class*="PointText_pointNum"]');
      var pt=0;
      if(ptEl){
        var ptm=(ptEl.innerText||'').replace(/,/g,'').match(/([0-9]+)/);
        if(ptm){pt=parseInt(ptm[1],10);}
      }

      var stEl=c.querySelector('[class*="ShopName_shopName"]');
      var store=stEl?(stEl.innerText||'').replace(/\s+/g,' ').trim():'';

      var prEl=c.querySelector('[class*="LabelComp_label-shubetu"]');
      var isPr=/^\[PR\]/i.test(title)||(prEl&&/PR|広告/.test(prEl.innerText||''));

      var q=parseQty(title);
      var net=Math.max(0,price+ship-pt);

      var oldB=c.querySelector('.wow-unit-badge');
      if(oldB){oldB.remove();}
      if(!isPr&&titleEl&&titleEl.parentNode){
        var badge=document.createElement('div');
        badge.className='wow-unit-badge';
        badge.style.cssText='margin:4px 0;padding:4px 8px;background:#fff1f2;border:1px solid #e11d48;border-radius:6px;font-size:12px;font-weight:700;color:#9f1239;display:inline-block;';
        badge.textContent='1'+q.unit+': '+Math.round(price/q.qty)+'円 (実質'+Math.round(net/q.qty)+'円・'+q.qty+q.unit+')';
        titleEl.parentNode.insertBefore(badge,titleEl.nextSibling);
      }

      list.push({
        idx:list.length,
        title:title,
        href:href,
        price:price,
        ship:ship,
        shipTxt:shipTxt,
        pt:pt,
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

  var items=parseCards();
  if(!items.length){
    alert('商品が見つかりませんでした。検索結果を表示した状態で実行してください。');
    return;
  }

  var stEl=document.getElementById('wow-unit-style');
  if(!stEl){
    stEl=document.createElement('style');
    stEl.id='wow-unit-style';
    stEl.textContent=
      '#wow-unit-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;-webkit-text-size-adjust:100%;}'+
      '#wow-unit-box{background:#fff;color:#111;width:100%;max-width:1020px;height:90vh;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);}'+
      '#wow-unit-head{background:#e11d48;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;justify-content:space-between;}'+
      '#wow-unit-title{font-size:15px;font-weight:700;flex:1;}'+
      '.wow-btn{border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;background:#e2e8f0;color:#1e293b;white-space:nowrap;}'+
      '.wow-btn-active{background:#0f172a;color:#fff;}'+
      '#wow-unit-ctrl{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}'+
      '#wow-unit-q{flex:1;min-width:160px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;}'+
      '#wow-price-range{width:130px;padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;}'+
      '#wow-price-target{padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;}'+
      '#wow-unit-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 12px 16px;}'+
      '.wow-tbl{width:100%;border-collapse:collapse;font-size:13px;}'+
      '.wow-tbl th{position:sticky;top:0;background:#f1f5f9;text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#475569;z-index:1;}'+
      '.wow-tbl td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;}'+
      '.wow-u{font-size:15px;font-weight:700;color:#be123c;white-space:nowrap;}'+
      '.wow-sub{font-size:12px;color:#475569;white-space:nowrap;}'+
      '.wow-qty-in{width:56px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;text-align:right;}'+
      '.wow-open{display:inline-block;padding:6px 10px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;}';
    document.head.appendChild(stEl);
  }

  var state={sort:'orig',dir:1,onlyFree:false,noPr:true,q:'',priceRange:'',priceTarget:'net'};
  var m=document.createElement('div');
  m.id='wow-unit-modal';
  m.innerHTML=
    '<div id="wow-unit-box">'+
      '<div id="wow-unit-head">'+
        '<div id="wow-unit-title">au PAY マーケット 単価一覧 v1.7 ('+items.length+'件)</div>'+
        '<button type="button" id="wow-close" class="wow-btn">閉じる</button>'+
      '</div>'+
      '<div id="wow-unit-ctrl">'+
        '<input id="wow-unit-q" type="search" placeholder="絞り込み (例: 24本 -訳あり)">'+
        '<select id="wow-price-target"><option value="net">実質価格</option><option value="price">商品価格</option></select>'+
        '<input id="wow-price-range" type="text" placeholder="例: 1-99999">'+
        '<button type="button" data-sort="net_unit" class="wow-btn">1個(実質)</button>'+
        '<button type="button" data-sort="unit" class="wow-btn">1個</button>'+
        '<button type="button" data-sort="net" class="wow-btn">実質価格</button>'+
        '<button type="button" data-sort="price" class="wow-btn">商品価格</button>'+
        '<button type="button" data-sort="orig" class="wow-btn wow-btn-active">元の順</button>'+
        '<button type="button" id="wow-dir" class="wow-btn wow-btn-active">昇順▲</button>'+
        '<button type="button" id="wow-free" class="wow-btn">送料無料のみ</button>'+
        '<button type="button" id="wow-nopr" class="wow-btn wow-btn-active">PR除外</button>'+
      '</div>'+
      '<div id="wow-unit-body"></div>'+
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
    var body=document.getElementById('wow-unit-body');
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
    var titleEl=document.getElementById('wow-unit-title');
    if(titleEl){titleEl.textContent='au PAY マーケット 単価一覧 v1.7 ('+arr.length+'/'+items.length+'件)';}

    var h='<table class="wow-tbl"><thead><tr>'+
      '<th>1個 / 1個(実質)</th><th>数量</th><th>商品価格 / 実質価格</th><th>商品名・ショップ</th><th></th>'+
      '</tr></thead><tbody>';
    for(var i=0;i<arr.length;i++){
      var it=arr[i];
      var u=(it.price/it.qty).toFixed(1).replace(/\.0$/,'');
      var nu=(it.net/it.qty).toFixed(1).replace(/\.0$/,'');
      h+='<tr>'+
        '<td><div class="wow-u">実質 '+nu+'円/'+esc(it.unit)+'</div><div class="wow-sub">1個 '+u+'円</div></td>'+
        '<td><input type="number" min="1" class="wow-qty-in" data-idx="'+it.idx+'" value="'+it.qty+'"><div class="wow-sub">'+esc(it.rule)+'</div></td>'+
        '<td><div><b>実質 '+it.net.toLocaleString()+'円</b></div><div class="wow-sub">商品 '+it.price.toLocaleString()+'円 / '+esc(it.shipTxt)+(it.pt?' / -'+it.pt+'pt':'')+'</div></td>'+
        '<td><div>'+esc(it.title)+'</div><div class="wow-sub">'+esc(it.store)+'</div></td>'+
        '<td><a class="wow-open" href="'+esc(it.href)+'" target="_blank" rel="noopener">開く</a></td>'+
        '</tr>';
    }
    h+='</tbody></table>';
    body.innerHTML=h;

    var qIns=body.querySelectorAll('.wow-qty-in');
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

  document.getElementById('wow-close').onclick=function(){m.remove();};
  document.getElementById('wow-unit-q').oninput=function(e){state.q=e.target.value.trim().toLowerCase();render();};
  document.getElementById('wow-price-range').oninput=function(e){state.priceRange=e.target.value;render();};
  document.getElementById('wow-price-target').onchange=function(e){state.priceTarget=e.target.value;render();};
  document.getElementById('wow-dir').onclick=function(e){
    state.dir*=-1;
    e.target.textContent=state.dir===1?'昇順▲':'降順▼';
    render();
  };
  document.getElementById('wow-free').onclick=function(e){
    state.onlyFree=!state.onlyFree;
    e.target.classList.toggle('wow-btn-active',state.onlyFree);
    render();
  };
  document.getElementById('wow-nopr').onclick=function(e){
    state.noPr=!state.noPr;
    e.target.classList.toggle('wow-btn-active',state.noPr);
    render();
  };
  var sBtns=m.querySelectorAll('[data-sort]');
  for(var i=0;i<sBtns.length;i++){
    sBtns[i].onclick=function(e){
      state.sort=e.target.getAttribute('data-sort');
      for(var j=0;j<sBtns.length;j++){sBtns[j].classList.remove('wow-btn-active');}
      e.target.classList.add('wow-btn-active');
      render();
    };
  }
  render();
})();
