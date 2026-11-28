(function(){
  if(!/amazon\.co\.jp/i.test(location.hostname)){
    alert('Amazon.co.jpの商品ページまたは検索結果ページで実行してください。');
    return;
  }
  var OLD=document.getElementById('amz-var-modal');
  if(OLD){OLD.remove();}

  var state={
    aborted:false,
    items:[],
    dims:[],
    dimLabels:{},
    sortMode:'price',
    onlyInStock:false,
    onlyAmazon:false,
    filterText:'',
    doneCount:0,
    totalCount:0,
    running:false,
    title:''
  };

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function extractJsonAfter(html,key){
    var idx=html.indexOf('"'+key+'"');
    if(idx<0){return null;}
    var colon=html.indexOf(':',idx);
    if(colon<0){return null;}
    var i=colon+1;
    while(i<html.length&&/\s/.test(html.charAt(i))){i++;}
    var open=html.charAt(i);
    var close=open==='{'?'}':(open==='['?']':null);
    if(!close){return null;}
    var depth=0,inStr=false,escCh=false;
    for(var j=i;j<html.length;j++){
      var ch=html.charAt(j);
      if(inStr){
        if(escCh){escCh=false;}
        else if(ch==='\\'){escCh=true;}
        else if(ch==='"'){inStr=false;}
      }else{
        if(ch==='"'){inStr=true;}
        else if(ch===open){depth++;}
        else if(ch===close){
          depth--;
          if(depth===0){
            try{return JSON.parse(html.slice(i,j+1));}catch(e){return null;}
          }
        }
      }
    }
    return null;
  }

  function getCurrentAsin(doc,urlStr){
    var el=doc.querySelector('#ASIN, input[name="ASIN"]');
    if(el&&el.value){return el.value.trim();}
    var m=(urlStr||location.href).match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return m?m[1].toUpperCase():'';
  }

  function parseProductDoc(doc,asin,dimValues){
    var priceSel=[
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#corePriceDisplay_mobile_feature_div .a-price .a-offscreen',
      '#price_inside_buybox',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#tp_price_block_total_price_ww .a-offscreen',
      '.a-price .a-offscreen'
    ];
    var priceText='';
    for(var i=0;i<priceSel.length;i++){
      var pe=doc.querySelector(priceSel[i]);
      if(pe&&pe.textContent&&/[0-9]/.test(pe.textContent)){
        priceText=pe.textContent.replace(/\s+/g,'').trim();
        break;
      }
    }
    var priceNum=999999999;
    if(priceText){
      var pm=priceText.replace(/,/g,'').match(/[0-9]+/);
      if(pm){priceNum=parseInt(pm[0],10);}
    }

    var unitEl=doc.querySelector('#corePriceDisplay_desktop_feature_div .pricePerUnit, #corePrice_feature_div .pricePerUnit, .pricePerUnit');
    var unitText=unitEl?unitEl.textContent.replace(/\s+/g,' ').trim():'';
    var unitNum=999999999;
    if(unitText){
      var um=unitText.replace(/,/g,'').match(/[0-9]+(?:\.[0-9]+)?/);
      if(um){unitNum=parseFloat(um[0]);}
    }else if(priceNum<999999999&&dimValues&&dimValues.length){
      var joined=dimValues.join(' ');
      var cm=joined.match(/(?:×|x|\*)\s*([0-9]+)\s*(?:個|本|袋|枚|錠|粒|パック|缶|包|回)/i)||joined.match(/([0-9]+)\s*(?:個|本|袋|枚|錠|粒|パック|缶|包)(?:入|セット)?/i);
      if(cm){
        var cnt=parseInt(cm[1],10);
        if(cnt>1){
          unitNum=Math.round(priceNum/cnt);
          unitText='約¥'+unitNum+'/個';
        }
      }
    }

    var shipEl=doc.querySelector('[tabular-attribute-name="出荷元"] .tabular-buybox-text, #fulfillerInfoFeature_feature_div .offer-display-feature-text-message');
    var soldEl=doc.querySelector('[tabular-attribute-name="販売元"] .tabular-buybox-text, #merchantInfoFeature_feature_div .offer-display-feature-text-message, #sellerProfileTriggerId');
    var ship=shipEl?shipEl.textContent.replace(/\s+/g,' ').trim():'';
    var sold=soldEl?soldEl.textContent.replace(/\s+/g,' ').trim():'';
    if(!sold){
      var mi=doc.querySelector('#merchant-info');
      if(mi){sold=mi.textContent.replace(/\s+/g,' ').trim();}
    }
    var seller='';
    if(sold&&ship){
      seller=(sold===ship)?sold:('販売:'+sold+' / 出荷:'+ship);
    }else{
      seller=sold||ship||'不明';
    }
    if(priceNum===999999999&&seller==='不明'){
      var aod=doc.querySelector('#buybox-see-all-buying-choices, #aod-ingress-link');
      if(aod){seller='他の出品者あり';}
    }

    var availEl=doc.querySelector('#availability span, #availability, #outOfStock');
    var avail=availEl?availEl.textContent.replace(/\s+/g,' ').trim():'';
    avail=avail.replace(/在庫状況について/g,'').trim();
    if(avail.length>28){avail=avail.slice(0,28)+'…';}
    var inStock=!!avail&&!/在庫切れ|お取り扱いできません|現在お取り扱い/.test(avail)&&priceNum<999999999;

    return {
      asin:asin,
      dims:dimValues||[],
      priceText:priceText||'価格なし',
      priceNum:priceNum,
      unitText:unitText||'-',
      unitNum:unitNum,
      seller:seller,
      sold:sold,
      ship:ship,
      avail:avail||(priceNum<999999999?'確認':'在庫なし'),
      inStock:inStock,
      loaded:true
    };
  }

  function injectStyle(){
    if(document.getElementById('amz-var-style')){return;}
    var st=document.createElement('style');
    st.id='amz-var-style';
    st.textContent=
      '#amz-var-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;-webkit-text-size-adjust:100%;}'+
      '#amz-var-box{background:#fff;color:#111;width:100%;max-width:980px;height:90vh;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);}'+
      '#amz-var-head{background:#232f3e;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;justify-content:space-between;}'+
      '#amz-var-title{font-size:15px;font-weight:700;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}'+
      '#amz-var-status{font-size:12px;background:#37475a;padding:4px 9px;border-radius:999px;white-space:nowrap;}'+
      '.amz-btn{border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;background:#e2e8f0;color:#1e293b;white-space:nowrap;}'+
      '.amz-btn-primary{background:#ff9900;color:#111;}'+
      '.amz-btn-danger{background:#ef4444;color:#fff;}'+
      '.amz-btn-active{background:#0f172a;color:#fff;}'+
      '#amz-var-ctrl{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}'+
      '#amz-var-search{flex:1;min-width:150px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;}'+
      '#amz-var-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 12px 16px;}'+
      '.amz-table{width:100%;border-collapse:collapse;font-size:13px;}'+
      '.amz-table th{position:sticky;top:0;background:#f1f5f9;text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#475569;z-index:1;}'+
      '.amz-table td{padding:9px 8px;border-bottom:1px solid #e2e8f0;vertical-align:middle;}'+
      '.amz-row-cur{background:#fffbeb;}'+
      '.amz-price{font-size:15px;font-weight:700;color:#b12704;white-space:nowrap;}'+
      '.amz-unit{font-size:12px;color:#475569;white-space:nowrap;}'+
      '.amz-badge{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:600;}'+
      '.amz-ok{background:#dcfce7;color:#166534;}'+
      '.amz-ng{background:#fee2e2;color:#991b1b;}'+
      '.amz-amz{background:#dbeafe;color:#1e40af;}'+
      '.amz-open{display:inline-block;padding:6px 10px;background:#ffd814;color:#111;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;}'+
      '.amz-s-btn{margin-top:6px;display:inline-block;padding:6px 10px;background:#232f3e;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;}'+
      '@media(max-width:640px){.amz-table th,.amz-table td{padding:7px 5px;font-size:12px;}}';
    document.head.appendChild(st);
  }

  function createModal(title){
    injectStyle();
    var m=document.createElement('div');
    m.id='amz-var-modal';
    m.innerHTML=
      '<div id="amz-var-box">'+
        '<div id="amz-var-head">'+
          '<div id="amz-var-title">v1.7 | '+esc(title)+'</div>'+
          '<div id="amz-var-status">準備中</div>'+
          '<button type="button" id="amz-var-stop" class="amz-btn amz-btn-danger">停止</button>'+
          '<button type="button" id="amz-var-close" class="amz-btn">閉じる</button>'+
        '</div>'+
        '<div id="amz-var-ctrl">'+
          '<input id="amz-var-search" type="search" placeholder="絞り込み (味・サイズ・出品者)">'+
          '<button type="button" data-sort="price" class="amz-btn amz-btn-active">価格順</button>'+
          '<button type="button" data-sort="unit" class="amz-btn">単価順</button>'+
          '<button type="button" data-sort="orig" class="amz-btn">元の順</button>'+
          '<button type="button" id="amz-var-stock" class="amz-btn">在庫あり</button>'+
          '<button type="button" id="amz-var-amz" class="amz-btn">Amazonのみ</button>'+
        '</div>'+
        '<div id="amz-var-body"></div>'+
      '</div>';
    document.body.appendChild(m);

    document.getElementById('amz-var-close').onclick=function(){
      state.aborted=true;
      m.remove();
    };
    document.getElementById('amz-var-stop').onclick=function(){
      state.aborted=true;
      render();
    };
    document.getElementById('amz-var-search').oninput=function(e){
      state.filterText=e.target.value.trim().toLowerCase();
      render();
    };
    document.getElementById('amz-var-stock').onclick=function(e){
      state.onlyInStock=!state.onlyInStock;
      e.target.classList.toggle('amz-btn-active',state.onlyInStock);
      render();
    };
    document.getElementById('amz-var-amz').onclick=function(e){
      state.onlyAmazon=!state.onlyAmazon;
      e.target.classList.toggle('amz-btn-active',state.onlyAmazon);
      render();
    };
    var sBtns=m.querySelectorAll('[data-sort]');
    for(var i=0;i<sBtns.length;i++){
      sBtns[i].onclick=function(e){
        state.sortMode=e.target.getAttribute('data-sort');
        for(var j=0;j<sBtns.length;j++){sBtns[j].classList.remove('amz-btn-active');}
        e.target.classList.add('amz-btn-active');
        render();
      };
    }
  }

  function render(){
    var stEl=document.getElementById('amz-var-status');
    var stopEl=document.getElementById('amz-var-stop');
    var bodyEl=document.getElementById('amz-var-body');
    if(!bodyEl){return;}
    if(stEl){
      stEl.textContent=(state.aborted?'停止 ': (state.doneCount<state.totalCount?'取得中 ':'完了 '))+state.doneCount+'/'+state.totalCount;
    }
    if(stopEl){
      stopEl.style.display=(state.running&&!state.aborted&&state.doneCount<state.totalCount)?'inline-block':'none';
    }

    var list=state.items.slice();
    if(state.onlyInStock){
      list=list.filter(function(it){return !it.loaded||it.inStock;});
    }
    if(state.onlyAmazon){
      list=list.filter(function(it){return !it.loaded||/Amazon/i.test(it.seller);});
    }
    if(state.filterText){
      list=list.filter(function(it){
        var txt=(it.dims.join(' ')+' '+it.seller+' '+it.avail+' '+it.asin).toLowerCase();
        return txt.indexOf(state.filterText)>=0;
      });
    }

    if(state.sortMode==='price'){
      list.sort(function(a,b){return a.priceNum-b.priceNum||a.idx-b.idx;});
    }else if(state.sortMode==='unit'){
      list.sort(function(a,b){return a.unitNum-b.unitNum||a.priceNum-b.priceNum||a.idx-b.idx;});
    }else{
      list.sort(function(a,b){return a.idx-b.idx;});
    }

    var dimHead=state.dims.length?state.dims.map(function(d){return esc(state.dimLabels[d]||d);}).join(' / '):'バリエーション';
    var html='<table class="amz-table"><thead><tr>'+
      '<th>'+dimHead+'</th>'+
      '<th>価格 / 単価</th>'+
      '<th>出品者・出荷元</th>'+
      '<th>在庫</th>'+
      '<th></th>'+
      '</tr></thead><tbody>';

    for(var i=0;i<list.length;i++){
      var it=list[i];
      var dimTxt=it.dims.length?it.dims.map(esc).join('<br>'):esc(it.asin);
      var rowCls=it.isCurrent?' class="amz-row-cur"':'';
      var stBadge=it.loaded
        ?('<span class="amz-badge '+(it.inStock?'amz-ok':'amz-ng')+'">'+esc(it.avail)+'</span>')
        :'<span class="amz-badge">取得中…</span>';
      var isAmz=/Amazon\.co\.jp/i.test(it.seller);
      var sellerHtml=it.loaded
        ?(isAmz?'<span class="amz-badge amz-amz">'+esc(it.seller)+'</span>':esc(it.seller))
        :'-';
      html+='<tr'+rowCls+'>'+
        '<td>'+dimTxt+(it.isCurrent?'<br><span class="amz-badge amz-amz">現在表示</span>':'')+'</td>'+
        '<td><div class="amz-price">'+esc(it.priceText)+'</div><div class="amz-unit">'+esc(it.unitText)+'</div></td>'+
        '<td>'+sellerHtml+'</td>'+
        '<td>'+stBadge+'</td>'+
        '<td><a class="amz-open" href="/dp/'+esc(it.asin)+'?th=1&psc=1">開く</a></td>'+
      '</tr>';
    }
    html+='</tbody></table>';
    bodyEl.innerHTML=html;
  }

  async function runForProduct(doc,htmlStr,baseAsin){
    state.aborted=false;
    state.running=true;
    state.filterText='';
    state.onlyInStock=false;
    state.onlyAmazon=false;
    state.sortMode='price';

    var tEl=doc.querySelector('#productTitle, #title');
    state.title=tEl?tEl.textContent.replace(/\s+/g,' ').trim():'Amazon バリエーション比較';
    createModal(state.title);

    var map=extractJsonAfter(htmlStr,'dimensionValuesDisplayData');
    var dims=extractJsonAfter(htmlStr,'dimensions');
    var labels=extractJsonAfter(htmlStr,'variationDisplayLabels');
    state.dims=Array.isArray(dims)?dims:[];
    state.dimLabels=(labels&&typeof labels==='object')?labels:{};

    var items=[];
    if(map&&typeof map==='object'){
      var keys=Object.keys(map);
      for(var i=0;i<keys.length;i++){
        var a=keys[i];
        items.push({
          idx:i,
          asin:a,
          dims:Array.isArray(map[a])?map[a]:[],
          priceText:'...',
          priceNum:999999999,
          unitText:'',
          unitNum:999999999,
          seller:'',
          avail:'',
          inStock:false,
          loaded:false,
          isCurrent:(a===baseAsin)
        });
      }
    }else{
      var seen={};
      var domNodes=doc.querySelectorAll('[data-asin],[data-defaultasin]');
      for(var j=0;j<domNodes.length;j++){
        var da=domNodes[j].getAttribute('data-asin')||domNodes[j].getAttribute('data-defaultasin');
        if(da&&/^[A-Z0-9]{10}$/i.test(da)&&!seen[da]){
          seen[da]=true;
          var lb=domNodes[j].textContent.replace(/\s+/g,' ').trim();
          if(lb&&lb.length<80){
            items.push({idx:items.length,asin:da.toUpperCase(),dims:[lb],priceText:'...',priceNum:999999999,unitText:'',unitNum:999999999,seller:'',avail:'',inStock:false,loaded:false,isCurrent:(da.toUpperCase()===baseAsin)});
          }
        }
      }
      if(!items.length&&baseAsin){
        items.push({idx:0,asin:baseAsin,dims:['現在の商品'],priceText:'...',priceNum:999999999,unitText:'',unitNum:999999999,seller:'',avail:'',inStock:false,loaded:false,isCurrent:true});
      }
    }

    if(items.length>60){items=items.slice(0,60);}
    state.items=items;
    state.totalCount=items.length;
    state.doneCount=0;

    for(var k=0;k<items.length;k++){
      if(items[k].asin===baseAsin){
        var cur=parseProductDoc(doc,baseAsin,items[k].dims);
        Object.assign(items[k],cur);
        state.doneCount++;
      }
    }
    render();

    var queue=items.filter(function(it){return !it.loaded;});
    var cursor=0;
    async function worker(){
      while(!state.aborted&&cursor<queue.length){
        var it=queue[cursor++];
        try{
          var res=await fetch('/dp/'+it.asin+'?th=1&psc=1',{credentials:'same-origin'});
          if(res.ok){
            var txt=await res.text();
            var pdoc=new DOMParser().parseFromString(txt,'text/html');
            var parsed=parseProductDoc(pdoc,it.asin,it.dims);
            Object.assign(it,parsed);
          }else{
            it.priceText='取得エラー('+res.status+')';
            it.avail='エラー';
            it.loaded=true;
          }
        }catch(e){
          it.priceText='取得失敗';
          it.avail='エラー';
          it.loaded=true;
        }
        state.doneCount++;
        render();
        await new Promise(function(r){setTimeout(r,180);});
      }
    }

    var workers=[];
    for(var w=0;w<2;w++){workers.push(worker());}
    await Promise.all(workers);
    state.running=false;
    render();
  }

  var curAsin=getCurrentAsin(document,location.href);
  if(curAsin&&/\/(dp|gp\/product)\//i.test(location.pathname)){
    runForProduct(document,document.documentElement.innerHTML,curAsin);
    return;
  }

  function toHalfAmz(s){
    return String(s||'').replace(/[０-９]/g,function(ch){
      return String.fromCharCode(ch.charCodeAt(0)-0xFEE0);
    }).replace(/✕|✖/g,'×');
  }
  function parseQtyAmz(rawTitle){
    var t=toHalfAmz(rawTitle);
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
  function parseRangeAmz(str){
    var s=toHalfAmz(str||'').replace(/,/g,'').trim();
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

  var cards=document.querySelectorAll('div[data-component-type="s-search-result"][data-asin]');
  if(cards.length){
    injectStyle();
    var oldUM=document.getElementById('amz-unit-modal');
    if(oldUM){oldUM.remove();}
    var sItems=[];
    for(var c=0;c<cards.length;c++){
      (function(card){
        var asin=card.getAttribute('data-asin');
        if(!asin){return;}
        var h2=card.querySelector('h2, .s-title-instructions-style');
        if(!h2){return;}
        var title=(h2.innerText||'').replace(/\s+/g,' ').trim();
        if(!title){return;}
        var aEl=h2.closest('a')||card.querySelector('h2 a, a.a-link-normal[href*="/dp/"]');
        var href=aEl?(aEl.getAttribute('href')||('/dp/'+asin)):('/dp/'+asin);

        if(!card.querySelector('.amz-s-btn')){
          var btn=document.createElement('button');
          btn.type='button';
          btn.className='amz-s-btn';
          btn.textContent='バリエーション比較';
          btn.onclick=async function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            btn.disabled=true;
            btn.textContent='読込中…';
            try{
              var r=await fetch('/dp/'+asin+'?th=1&psc=1',{credentials:'same-origin'});
              var tx=await r.text();
              var d=new DOMParser().parseFromString(tx,'text/html');
              await runForProduct(d,tx,asin);
            }catch(e){
              alert('商品ページの取得に失敗しました。');
            }finally{
              btn.disabled=false;
              btn.textContent='バリエーション比較';
            }
          };
          h2.parentNode.insertBefore(btn,h2.nextSibling);
        }

        var priceEl=card.querySelector('.a-price:not(.a-text-price) .a-offscreen');
        var priceTxt=priceEl?(priceEl.textContent||''):'';
        var pm=priceTxt.replace(/,/g,'').match(/([0-9]+)/);
        if(!pm){return;}
        var price=parseInt(pm[1],10);

        var cardTxt=(card.innerText||'').replace(/\s+/g,' ');
        var pt=0;
        var ptm=cardTxt.replace(/,/g,'').match(/([0-9]+)\s*ポイント/);
        if(ptm){pt=parseInt(ptm[1],10);}

        var ship=0;
        var shipTxt='無料配送';
        if(!/無料配送|配送料無料/.test(cardTxt)){
          var sm=cardTxt.replace(/,/g,'').match(/配送料\s*[￥¥]?\s*([0-9]+)/);
          if(sm){ship=parseInt(sm[1],10);shipTxt='+送料'+ship+'円';}
          else{shipTxt='配送確認';}
        }

        var isPr=card.classList.contains('AdHolder')||!!card.querySelector('.puis-sponsored-label-text, [data-component-type="sp-sponsored-result"]')||/\bスポンサー\b/.test(cardTxt);
        var q=parseQtyAmz(title);
        var net=Math.max(0,price+ship-pt);

        var oldB=card.querySelector('.amz-unit-badge');
        if(oldB){oldB.remove();}
        if(!isPr){
          var badge=document.createElement('div');
          badge.className='amz-unit-badge';
          badge.style.cssText='margin:4px 0;padding:4px 8px;background:#fffbeb;border:1px solid #ff9900;border-radius:6px;font-size:12px;font-weight:700;color:#92400e;display:inline-block;';
          badge.textContent='1'+q.unit+': '+Math.round(price/q.qty)+'円 (実質'+Math.round(net/q.qty)+'円・'+q.qty+q.unit+')';
          h2.parentNode.insertBefore(badge,h2.nextSibling);
        }

        sItems.push({
          idx:sItems.length,
          asin:asin,
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
          isPr:isPr
        });
      })(cards[c]);
    }

    if(!sItems.length){
      alert('価格付きの検索結果が見つかりませんでした。');
      return;
    }

    var uSt=document.getElementById('amz-unit-style');
    if(!uSt){
      uSt=document.createElement('style');
      uSt.id='amz-unit-style';
      uSt.textContent=
        '#amz-unit-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;-webkit-text-size-adjust:100%;}'+
        '#amz-unit-box{background:#fff;color:#111;width:100%;max-width:1020px;height:90vh;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);}'+
        '#amz-unit-head{background:#232f3e;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px;justify-content:space-between;}'+
        '#amz-unit-title{font-size:15px;font-weight:700;flex:1;}'+
        '#amz-unit-ctrl{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}'+
        '#amz-unit-q{flex:1;min-width:160px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;}'+
        '#amz-price-range{width:130px;padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;}'+
        '#amz-price-target{padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;}'+
        '#amz-unit-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:8px 12px 16px;}'+
        '.amz-u{font-size:15px;font-weight:700;color:#b12704;white-space:nowrap;}'+
        '.amz-sub{font-size:12px;color:#475569;white-space:nowrap;}'+
        '.amz-qty-in{width:56px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;text-align:right;}';
      document.head.appendChild(uSt);
    }

    var uState={sort:'orig',dir:1,onlyFree:false,noPr:true,q:'',priceRange:'',priceTarget:'net'};
    var um=document.createElement('div');
    um.id='amz-unit-modal';
    um.innerHTML=
      '<div id="amz-unit-box">'+
        '<div id="amz-unit-head">'+
          '<div id="amz-unit-title">Amazon 単価一覧 v1.7 ('+sItems.length+'件)</div>'+
          '<button type="button" id="amz-u-close" class="amz-btn">閉じる</button>'+
        '</div>'+
        '<div id="amz-unit-ctrl">'+
          '<input id="amz-unit-q" type="search" placeholder="絞り込み (例: 24本 -訳あり)">'+
          '<select id="amz-price-target"><option value="net">実質価格</option><option value="price">商品価格</option></select>'+
          '<input id="amz-price-range" type="text" placeholder="例: 1-99999">'+
          '<button type="button" data-usort="net_unit" class="amz-btn">1個(実質)</button>'+
          '<button type="button" data-usort="unit" class="amz-btn">1個</button>'+
          '<button type="button" data-usort="net" class="amz-btn">実質価格</button>'+
          '<button type="button" data-usort="price" class="amz-btn">商品価格</button>'+
          '<button type="button" data-usort="orig" class="amz-btn amz-btn-active">元の順</button>'+
          '<button type="button" id="amz-u-dir" class="amz-btn amz-btn-active">昇順▲</button>'+
          '<button type="button" id="amz-u-free" class="amz-btn">送料無料のみ</button>'+
          '<button type="button" id="amz-u-nopr" class="amz-btn amz-btn-active">PR除外</button>'+
        '</div>'+
        '<div id="amz-unit-body"></div>'+
      '</div>';
    document.body.appendChild(um);

    function renderU(){
      var body=document.getElementById('amz-unit-body');
      var arr=sItems.slice();
      if(uState.noPr){arr=arr.filter(function(it){return !it.isPr;});}
      if(uState.onlyFree){arr=arr.filter(function(it){return it.ship===0;});}
      if(uState.q){
        var tokens=uState.q.split(/\s+/).filter(Boolean);
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
      var rg=parseRangeAmz(uState.priceRange);
      if(rg){
        arr=arr.filter(function(it){
          var val=uState.priceTarget==='price'?it.price:it.net;
          return val>=rg.min&&val<=rg.max;
        });
      }
      var d=uState.dir;
      if(uState.sort==='net_unit'){
        arr.sort(function(a,b){return d*((a.net/a.qty)-(b.net/b.qty))||d*(a.net-b.net);});
      }else if(uState.sort==='unit'){
        arr.sort(function(a,b){return d*((a.price/a.qty)-(b.price/b.qty))||d*(a.price-b.price);});
      }else if(uState.sort==='net'){
        arr.sort(function(a,b){return d*(a.net-b.net)||a.idx-b.idx;});
      }else if(uState.sort==='price'){
        arr.sort(function(a,b){return d*(a.price-b.price)||a.idx-b.idx;});
      }else{
        arr.sort(function(a,b){return d*(a.idx-b.idx);});
      }
      var tEl=document.getElementById('amz-unit-title');
      if(tEl){tEl.textContent='Amazon 単価一覧 v1.7 ('+arr.length+'/'+sItems.length+'件)';}

      var h='<table class="amz-table"><thead><tr>'+
        '<th>1個 / 1個(実質)</th><th>数量</th><th>商品価格 / 実質価格</th><th>商品名</th><th></th>'+
        '</tr></thead><tbody>';
      for(var i=0;i<arr.length;i++){
        var it=arr[i];
        var u=(it.price/it.qty).toFixed(1).replace(/\.0$/,'');
        var nu=(it.net/it.qty).toFixed(1).replace(/\.0$/,'');
        h+='<tr>'+
          '<td><div class="amz-u">実質 '+nu+'円/'+esc(it.unit)+'</div><div class="amz-sub">1個 '+u+'円</div></td>'+
          '<td><input type="number" min="1" class="amz-qty-in" data-idx="'+it.idx+'" value="'+it.qty+'"><div class="amz-sub">'+esc(it.rule)+'</div></td>'+
          '<td><div><b>実質 '+it.net.toLocaleString()+'円</b></div><div class="amz-sub">商品 '+it.price.toLocaleString()+'円 / '+esc(it.shipTxt)+(it.pt?' / -'+it.pt+'pt':'')+'</div></td>'+
          '<td><div>'+esc(it.title)+'</div></td>'+
          '<td><a class="amz-open" href="'+esc(it.href)+'" target="_blank" rel="noopener">開く</a></td>'+
          '</tr>';
      }
      h+='</tbody></table>';
      body.innerHTML=h;

      var qIns=body.querySelectorAll('.amz-qty-in');
      for(var k=0;k<qIns.length;k++){
        qIns[k].onchange=function(e){
          var idx=parseInt(e.target.getAttribute('data-idx'),10);
          var val=parseInt(e.target.value,10);
          if(val>0){
            for(var z=0;z<sItems.length;z++){
              if(sItems[z].idx===idx){sItems[z].qty=val;sItems[z].rule='手動';break;}
            }
            renderU();
          }
        };
      }
    }

    document.getElementById('amz-u-close').onclick=function(){um.remove();};
    document.getElementById('amz-unit-q').oninput=function(e){uState.q=e.target.value.trim().toLowerCase();renderU();};
    document.getElementById('amz-price-range').oninput=function(e){uState.priceRange=e.target.value;renderU();};
    document.getElementById('amz-price-target').onchange=function(e){uState.priceTarget=e.target.value;renderU();};
    document.getElementById('amz-u-dir').onclick=function(e){
      uState.dir*=-1;
      e.target.textContent=uState.dir===1?'昇順▲':'降順▼';
      renderU();
    };
    document.getElementById('amz-u-free').onclick=function(e){
      uState.onlyFree=!uState.onlyFree;
      e.target.classList.toggle('amz-btn-active',uState.onlyFree);
      renderU();
    };
    document.getElementById('amz-u-nopr').onclick=function(e){
      uState.noPr=!uState.noPr;
      e.target.classList.toggle('amz-btn-active',uState.noPr);
      renderU();
    };
    var sBtns=um.querySelectorAll('[data-usort]');
    for(var i=0;i<sBtns.length;i++){
      sBtns[i].onclick=function(e){
        uState.sort=e.target.getAttribute('data-usort');
        for(var j=0;j<sBtns.length;j++){sBtns[j].classList.remove('amz-btn-active');}
        e.target.classList.add('amz-btn-active');
        renderU();
      };
    }
    renderU();
    return;
  }

  alert('Amazon.co.jpの商品ページまたは検索結果ページで実行してください。');
})();
