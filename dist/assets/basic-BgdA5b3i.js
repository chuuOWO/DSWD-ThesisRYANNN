import{i as O,C as J,A as j,O as z,a as M,b as k,c as At,d as u,E as H,R as B,e as U,f as qt,g as Hn,h as ue,H as Kn,j as ee,r as Y,k as ye,T as je,S as Be,M as _n,l as Sn,m as Tn,n as Gn,o as In,w as Ue,p as Qn,q as Jn,s as Yn,t as zt,u as An,W as Pt}from"./core-Ejby4lZo.js";import{n as p,r as P,c as N,o as D,U as se,i as Xn,t as Zn,e as ei,a as ti}from"./index-DxCe14Ya.js";import{V as ni}from"./index-DOhbwcnN.js";var Se=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let fe=class extends O{constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=J.state.connectors,this.count=j.state.count,this.filteredCount=j.state.filteredWallets.length,this.isFetchingRecommendedWallets=j.state.isFetchingRecommendedWallets,this.unsubscribe.push(J.subscribeKey("connectors",e=>this.connectors=e),j.subscribeKey("count",e=>this.count=e),j.subscribeKey("filteredWallets",e=>this.filteredCount=e.length),j.subscribeKey("isFetchingRecommendedWallets",e=>this.isFetchingRecommendedWallets=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){const e=this.connectors.find(c=>c.id==="walletConnect"),{allWallets:i}=z.state;if(!e||i==="HIDE"||i==="ONLY_MOBILE"&&!M.isMobile())return null;const r=j.state.featured.length,o=this.count+r,n=o<10?o:Math.floor(o/10)*10,s=this.filteredCount>0?this.filteredCount:n;let a=`${s}`;this.filteredCount>0?a=`${this.filteredCount}`:s<o&&(a=`${s}+`);const l=k.hasAnyConnection(At.CONNECTOR_ID.WALLET_CONNECT);return u`
      <wui-list-wallet
        name="Search Wallet"
        walletIcon="search"
        showAllWallets
        @click=${this.onAllWallets.bind(this)}
        tagLabel=${a}
        tagVariant="info"
        data-testid="all-wallets"
        tabIdx=${D(this.tabIdx)}
        .loading=${this.isFetchingRecommendedWallets}
        ?disabled=${l}
        size="sm"
      ></wui-list-wallet>
    `}onAllWallets(){var e;H.sendEvent({type:"track",event:"CLICK_ALL_WALLETS"}),B.push("AllWallets",{redirectView:(e=B.state.data)==null?void 0:e.redirectView})}};Se([p()],fe.prototype,"tabIdx",void 0);Se([P()],fe.prototype,"connectors",void 0);Se([P()],fe.prototype,"count",void 0);Se([P()],fe.prototype,"filteredCount",void 0);Se([P()],fe.prototype,"isFetchingRecommendedWallets",void 0);fe=Se([N("w3m-all-wallets-widget")],fe);const ii=U`
  :host {
    margin-top: ${({spacing:t})=>t[1]};
  }
  wui-separator {
    margin: ${({spacing:t})=>t[3]} calc(${({spacing:t})=>t[3]} * -1)
      ${({spacing:t})=>t[2]} calc(${({spacing:t})=>t[3]} * -1);
    width: calc(100% + ${({spacing:t})=>t[3]} * 2);
  }
`;var Te=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let de=class extends O{constructor(){super(),this.unsubscribe=[],this.explorerWallets=j.state.explorerWallets,this.connections=k.state.connections,this.connectorImages=qt.state.connectorImages,this.loadingTelegram=!1,this.unsubscribe.push(k.subscribeKey("connections",e=>this.connections=e),qt.subscribeKey("connectorImages",e=>this.connectorImages=e),j.subscribeKey("explorerFilteredWallets",e=>{this.explorerWallets=e!=null&&e.length?e:j.state.explorerWallets}),j.subscribeKey("explorerWallets",e=>{var i;(i=this.explorerWallets)!=null&&i.length||(this.explorerWallets=e)})),M.isTelegram()&&M.isIos()&&(this.loadingTelegram=!k.state.wcUri,this.unsubscribe.push(k.subscribeKey("wcUri",e=>this.loadingTelegram=!e)))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return u`
      <wui-flex flexDirection="column" gap="2"> ${this.connectorListTemplate()} </wui-flex>
    `}connectorListTemplate(){return Hn.connectorList().map((e,i)=>e.kind==="connector"?this.renderConnector(e,i):this.renderWallet(e,i))}getConnectorNamespaces(e){var i;return e.subtype==="walletConnect"?[]:e.subtype==="multiChain"?((i=e.connector.connectors)==null?void 0:i.map(r=>r.chain))||[]:[e.connector.chain]}renderConnector(e,i){var C,b;const r=e.connector,o=ue.getConnectorImage(r)||this.connectorImages[(r==null?void 0:r.imageId)??""],s=(this.connections.get(r.chain)??[]).some(h=>Kn.isLowerCaseMatch(h.connectorId,r.id));let a,l;e.subtype==="walletConnect"?(a="qr code",l="accent"):e.subtype==="injected"||e.subtype==="announced"?(a=s?"connected":"installed",l=s?"info":"success"):(a=void 0,l=void 0);const c=k.hasAnyConnection(At.CONNECTOR_ID.WALLET_CONNECT),d=e.subtype==="walletConnect"||e.subtype==="external"?c:!1;return u`
      <w3m-list-wallet
        displayIndex=${i}
        imageSrc=${D(o)}
        .installed=${!0}
        name=${r.name??"Unknown"}
        .tagVariant=${l}
        tagLabel=${D(a)}
        data-testid=${`wallet-selector-${r.id.toLowerCase()}`}
        size="sm"
        @click=${()=>this.onClickConnector(e)}
        tabIdx=${D(this.tabIdx)}
        ?disabled=${d}
        rdnsId=${D(((C=r.explorerWallet)==null?void 0:C.rdns)||void 0)}
        walletRank=${D((b=r.explorerWallet)==null?void 0:b.order)}
        .namespaces=${this.getConnectorNamespaces(e)}
      >
      </w3m-list-wallet>
    `}onClickConnector(e){var r;const i=(r=B.state.data)==null?void 0:r.redirectView;if(e.subtype==="walletConnect"){J.setActiveConnector(e.connector),M.isMobile()?B.push("AllWallets"):B.push("ConnectingWalletConnect",{redirectView:i});return}if(e.subtype==="multiChain"){J.setActiveConnector(e.connector),B.push("ConnectingMultiChain",{redirectView:i});return}if(e.subtype==="injected"){J.setActiveConnector(e.connector),B.push("ConnectingExternal",{connector:e.connector,redirectView:i,wallet:e.connector.explorerWallet});return}if(e.subtype==="announced"){if(e.connector.id==="walletConnect"){M.isMobile()?B.push("AllWallets"):B.push("ConnectingWalletConnect",{redirectView:i});return}B.push("ConnectingExternal",{connector:e.connector,redirectView:i,wallet:e.connector.explorerWallet});return}B.push("ConnectingExternal",{connector:e.connector,redirectView:i})}renderWallet(e,i){const r=e.wallet,o=ue.getWalletImage(r),s=k.hasAnyConnection(At.CONNECTOR_ID.WALLET_CONNECT),a=this.loadingTelegram,l=e.subtype==="recent"?"recent":void 0,c=e.subtype==="recent"?"info":void 0;return u`
      <w3m-list-wallet
        displayIndex=${i}
        imageSrc=${D(o)}
        name=${r.name??"Unknown"}
        @click=${()=>this.onClickWallet(e)}
        size="sm"
        data-testid=${`wallet-selector-${r.id}`}
        tabIdx=${D(this.tabIdx)}
        ?loading=${a}
        ?disabled=${s}
        rdnsId=${D(r.rdns||void 0)}
        walletRank=${D(r.order)}
        tagLabel=${D(l)}
        .tagVariant=${c}
      >
      </w3m-list-wallet>
    `}onClickWallet(e){var n;const i=(n=B.state.data)==null?void 0:n.redirectView,r=ee.state.activeChain;if(e.subtype==="featured"){J.selectWalletConnector(e.wallet);return}if(e.subtype==="recent"){if(this.loadingTelegram)return;J.selectWalletConnector(e.wallet);return}if(e.subtype==="custom"){if(this.loadingTelegram)return;B.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:i});return}if(this.loadingTelegram)return;const o=r?J.getConnector({id:e.wallet.id,namespace:r}):void 0;o?B.push("ConnectingExternal",{connector:o,redirectView:i}):B.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:i})}};de.styles=ii;Te([p({type:Number})],de.prototype,"tabIdx",void 0);Te([P()],de.prototype,"explorerWallets",void 0);Te([P()],de.prototype,"connections",void 0);Te([P()],de.prototype,"connectorImages",void 0);Te([P()],de.prototype,"loadingTelegram",void 0);de=Te([N("w3m-connector-list")],de);const ri=U`
  :host {
    flex: 1;
    height: 100%;
  }

  button {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: ${({spacing:t})=>t[1]} ${({spacing:t})=>t[2]};
    column-gap: ${({spacing:t})=>t[1]};
    color: ${({tokens:t})=>t.theme.textSecondary};
    border-radius: ${({borderRadius:t})=>t[20]};
    background-color: transparent;
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  button[data-active='true'] {
    color: ${({tokens:t})=>t.theme.textPrimary};
    background-color: ${({tokens:t})=>t.theme.foregroundTertiary};
  }

  button:hover:enabled:not([data-active='true']),
  button:active:enabled:not([data-active='true']) {
    wui-text,
    wui-icon {
      color: ${({tokens:t})=>t.theme.textPrimary};
    }
  }
`;var ke=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};const oi={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},si={lg:"md",md:"sm",sm:"sm"};let pe=class extends O{constructor(){super(...arguments),this.icon="mobile",this.size="md",this.label="",this.active=!1}render(){return u`
      <button data-active=${this.active}>
        ${this.icon?u`<wui-icon size=${si[this.size]} name=${this.icon}></wui-icon>`:""}
        <wui-text variant=${oi[this.size]}> ${this.label} </wui-text>
      </button>
    `}};pe.styles=[Y,ye,ri];ke([p()],pe.prototype,"icon",void 0);ke([p()],pe.prototype,"size",void 0);ke([p()],pe.prototype,"label",void 0);ke([p({type:Boolean})],pe.prototype,"active",void 0);pe=ke([N("wui-tab-item")],pe);const ai=U`
  :host {
    display: inline-flex;
    align-items: center;
    background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    border-radius: ${({borderRadius:t})=>t[32]};
    padding: ${({spacing:t})=>t["01"]};
    box-sizing: border-box;
  }

  :host([data-size='sm']) {
    height: 26px;
  }

  :host([data-size='md']) {
    height: 36px;
  }
`;var Le=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let ge=class extends O{constructor(){super(...arguments),this.tabs=[],this.onTabChange=()=>null,this.size="md",this.activeTab=0}render(){return this.dataset.size=this.size,this.tabs.map((e,i)=>{var o;const r=i===this.activeTab;return u`
        <wui-tab-item
          @click=${()=>this.onTabClick(i)}
          icon=${e.icon}
          size=${this.size}
          label=${e.label}
          ?active=${r}
          data-active=${r}
          data-testid="tab-${(o=e.label)==null?void 0:o.toLowerCase()}"
        ></wui-tab-item>
      `})}onTabClick(e){this.activeTab=e,this.onTabChange(e)}};ge.styles=[Y,ye,ai];Le([p({type:Array})],ge.prototype,"tabs",void 0);Le([p()],ge.prototype,"onTabChange",void 0);Le([p()],ge.prototype,"size",void 0);Le([P()],ge.prototype,"activeTab",void 0);ge=Le([N("wui-tabs")],ge);var Bt=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let qe=class extends O{constructor(){super(...arguments),this.platformTabs=[],this.unsubscribe=[],this.platforms=[],this.onSelectPlatfrom=void 0}disconnectCallback(){this.unsubscribe.forEach(e=>e())}render(){const e=this.generateTabs();return u`
      <wui-flex justifyContent="center" .padding=${["0","0","4","0"]}>
        <wui-tabs .tabs=${e} .onTabChange=${this.onTabChange.bind(this)}></wui-tabs>
      </wui-flex>
    `}generateTabs(){const e=this.platforms.map(i=>i==="browser"?{label:"Browser",icon:"extension",platform:"browser"}:i==="mobile"?{label:"Mobile",icon:"mobile",platform:"mobile"}:i==="qrcode"?{label:"Mobile",icon:"mobile",platform:"qrcode"}:i==="web"?{label:"Webapp",icon:"browser",platform:"web"}:i==="desktop"?{label:"Desktop",icon:"desktop",platform:"desktop"}:{label:"Browser",icon:"extension",platform:"unsupported"});return this.platformTabs=e.map(({platform:i})=>i),e}onTabChange(e){var r;const i=this.platformTabs[e];i&&((r=this.onSelectPlatfrom)==null||r.call(this,i))}};Bt([p({type:Array})],qe.prototype,"platforms",void 0);Bt([p()],qe.prototype,"onSelectPlatfrom",void 0);qe=Bt([N("w3m-connecting-header")],qe);const li=U`
  :host {
    display: block;
    width: 100px;
    height: 100px;
  }

  svg {
    width: 100px;
    height: 100px;
  }

  rect {
    fill: none;
    stroke: ${t=>t.colors.accent100};
    stroke-width: 3px;
    stroke-linecap: round;
    animation: dash 1s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0px;
    }
  }
`;var Pn=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let ze=class extends O{constructor(){super(...arguments),this.radius=36}render(){return this.svgLoaderTemplate()}svgLoaderTemplate(){const e=this.radius>50?50:this.radius,r=36-e,o=116+r,n=245+r,s=360+r*1.75;return u`
      <svg viewBox="0 0 110 110" width="110" height="110">
        <rect
          x="2"
          y="2"
          width="106"
          height="106"
          rx=${e}
          stroke-dasharray="${o} ${n}"
          stroke-dashoffset=${s}
        />
      </svg>
    `}};ze.styles=[Y,li];Pn([p({type:Number})],ze.prototype,"radius",void 0);ze=Pn([N("wui-loading-thumbnail")],ze);const ci=U`
  wui-flex {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[5]};
    padding-left: ${({spacing:t})=>t[3]};
    padding-right: ${({spacing:t})=>t[3]};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({spacing:t})=>t[6]};
  }

  wui-text {
    color: ${({tokens:t})=>t.theme.textSecondary};
  }

  wui-icon {
    width: 12px;
    height: 12px;
  }
`;var Xe=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Re=class extends O{constructor(){super(...arguments),this.disabled=!1,this.label="",this.buttonLabel=""}render(){return u`
      <wui-flex justifyContent="space-between" alignItems="center">
        <wui-text variant="lg-regular" color="inherit">${this.label}</wui-text>
        <wui-button variant="accent-secondary" size="sm">
          ${this.buttonLabel}
          <wui-icon name="chevronRight" color="inherit" size="inherit" slot="iconRight"></wui-icon>
        </wui-button>
      </wui-flex>
    `}};Re.styles=[Y,ye,ci];Xe([p({type:Boolean})],Re.prototype,"disabled",void 0);Xe([p()],Re.prototype,"label",void 0);Xe([p()],Re.prototype,"buttonLabel",void 0);Re=Xe([N("wui-cta-button")],Re);const ui=U`
  :host {
    display: block;
    padding: 0 ${({spacing:t})=>t[5]} ${({spacing:t})=>t[5]};
  }
`;var Wn=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Fe=class extends O{constructor(){super(...arguments),this.wallet=void 0}render(){if(!this.wallet)return this.style.display="none",null;const{name:e,app_store:i,play_store:r,chrome_store:o,homepage:n}=this.wallet,s=M.isMobile(),a=M.isIos(),l=M.isAndroid(),c=[i,r,n,o].filter(Boolean).length>1,d=se.getTruncateString({string:e,charsStart:12,charsEnd:0,truncate:"end"});return c&&!s?u`
        <wui-cta-button
          label=${`Don't have ${d}?`}
          buttonLabel="Get"
          @click=${()=>B.push("Downloads",{wallet:this.wallet})}
        ></wui-cta-button>
      `:!c&&n?u`
        <wui-cta-button
          label=${`Don't have ${d}?`}
          buttonLabel="Get"
          @click=${this.onHomePage.bind(this)}
        ></wui-cta-button>
      `:i&&a?u`
        <wui-cta-button
          label=${`Don't have ${d}?`}
          buttonLabel="Get"
          @click=${this.onAppStore.bind(this)}
        ></wui-cta-button>
      `:r&&l?u`
        <wui-cta-button
          label=${`Don't have ${d}?`}
          buttonLabel="Get"
          @click=${this.onPlayStore.bind(this)}
        ></wui-cta-button>
      `:(this.style.display="none",null)}onAppStore(){var e;(e=this.wallet)!=null&&e.app_store&&M.openHref(this.wallet.app_store,"_blank")}onPlayStore(){var e;(e=this.wallet)!=null&&e.play_store&&M.openHref(this.wallet.play_store,"_blank")}onHomePage(){var e;(e=this.wallet)!=null&&e.homepage&&M.openHref(this.wallet.homepage,"_blank")}};Fe.styles=[ui];Wn([p({type:Object})],Fe.prototype,"wallet",void 0);Fe=Wn([N("w3m-mobile-download-links")],Fe);const di=U`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-wallet-image {
    width: 56px;
    height: 56px;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:t})=>t[1]} * -1);
    bottom: calc(${({spacing:t})=>t[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition-property: opacity, transform;
    transition-duration: ${({durations:t})=>t.lg};
    transition-timing-function: ${({easings:t})=>t["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:t})=>t[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:t})=>t["ease-out-power-2"]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  w3m-mobile-download-links {
    padding: 0px;
    width: 100%;
  }
`;var X=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};class q extends O{constructor(){var e,i,r,o,n;super(),this.wallet=(e=B.state.data)==null?void 0:e.wallet,this.connector=(i=B.state.data)==null?void 0:i.connector,this.timeout=void 0,this.secondaryBtnIcon="refresh",this.onConnect=void 0,this.onRender=void 0,this.onAutoConnect=void 0,this.isWalletConnect=!0,this.unsubscribe=[],this.imageSrc=ue.getConnectorImage(this.connector)??ue.getWalletImage(this.wallet),this.name=((r=this.wallet)==null?void 0:r.name)??((o=this.connector)==null?void 0:o.name)??"Wallet",this.isRetrying=!1,this.uri=k.state.wcUri,this.error=k.state.wcError,this.ready=!1,this.showRetry=!1,this.label=void 0,this.secondaryBtnLabel="Try again",this.secondaryLabel="Accept connection request in the wallet",this.isLoading=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(k.subscribeKey("wcUri",s=>{var a;this.uri=s,this.isRetrying&&this.onRetry&&(this.isRetrying=!1,(a=this.onConnect)==null||a.call(this))}),k.subscribeKey("wcError",s=>this.error=s)),(M.isTelegram()||M.isSafari())&&M.isIos()&&k.state.wcUri&&((n=this.onConnect)==null||n.call(this))}firstUpdated(){var e;(e=this.onAutoConnect)==null||e.call(this),this.showRetry=!this.onAutoConnect}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),k.setWcError(!1),clearTimeout(this.timeout)}render(){var r;(r=this.onRender)==null||r.call(this),this.onShowRetry();const e=this.error?"Connection can be declined if a previous request is still active":this.secondaryLabel;let i="";return this.label?i=this.label:(i=`Continue in ${this.name}`,this.error&&(i="Connection declined")),u`
      <wui-flex
        data-error=${D(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex gap="2" justifyContent="center" alignItems="center">
          <wui-wallet-image size="lg" imageSrc=${D(this.imageSrc)}></wui-wallet-image>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex flexDirection="column" alignItems="center" gap="6"> <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${["2","0","0","0"]}
        >
          <wui-text align="center" variant="lg-medium" color=${this.error?"error":"primary"}>
            ${i}
          </wui-text>
          <wui-text align="center" variant="lg-regular" color="secondary">${e}</wui-text>
        </wui-flex>

        ${this.secondaryBtnLabel?u`
                <wui-button
                  variant="neutral-secondary"
                  size="md"
                  ?disabled=${this.isRetrying||this.isLoading}
                  @click=${this.onTryAgain.bind(this)}
                  data-testid="w3m-connecting-widget-secondary-button"
                >
                  <wui-icon
                    color="inherit"
                    slot="iconLeft"
                    name=${this.secondaryBtnIcon}
                  ></wui-icon>
                  ${this.secondaryBtnLabel}
                </wui-button>
              `:null}
      </wui-flex>

      ${this.isWalletConnect?u`
              <wui-flex .padding=${["0","5","5","5"]} justifyContent="center">
                <wui-link
                  @click=${this.onCopyUri}
                  variant="secondary"
                  icon="copy"
                  data-testid="wui-link-copy"
                >
                  Copy link
                </wui-link>
              </wui-flex>
            `:null}

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links></wui-flex>
      </wui-flex>
    `}onShowRetry(){var e;if(this.error&&!this.showRetry){this.showRetry=!0;const i=(e=this.shadowRoot)==null?void 0:e.querySelector("wui-button");i==null||i.animate([{opacity:0},{opacity:1}],{fill:"forwards",easing:"ease"})}}onTryAgain(){var e,i;k.setWcError(!1),this.onRetry?(this.isRetrying=!0,(e=this.onRetry)==null||e.call(this)):(i=this.onConnect)==null||i.call(this)}loaderTemplate(){const e=je.state.themeVariables["--w3m-border-radius-master"],i=e?parseInt(e.replace("px",""),10):4;return u`<wui-loading-thumbnail radius=${i*9}></wui-loading-thumbnail>`}onCopyUri(){try{this.uri&&(M.copyToClopboard(this.uri),Be.showSuccess("Link copied"))}catch{Be.showError("Failed to copy")}}}q.styles=di;X([P()],q.prototype,"isRetrying",void 0);X([P()],q.prototype,"uri",void 0);X([P()],q.prototype,"error",void 0);X([P()],q.prototype,"ready",void 0);X([P()],q.prototype,"showRetry",void 0);X([P()],q.prototype,"label",void 0);X([P()],q.prototype,"secondaryBtnLabel",void 0);X([P()],q.prototype,"secondaryLabel",void 0);X([P()],q.prototype,"isLoading",void 0);X([p({type:Boolean})],q.prototype,"isMobile",void 0);X([p()],q.prototype,"onRetry",void 0);var hi=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Ft=class extends q{constructor(){var e;if(super(),!this.wallet)throw new Error("w3m-connecting-wc-browser: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onAutoConnect=this.onConnectProxy.bind(this),H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:(e=this.wallet)==null?void 0:e.display_index,walletRank:this.wallet.order,view:B.state.view}})}async onConnectProxy(){try{this.error=!1;const{connectors:e}=J.state,i=e.find(r=>{var o,n,s;return r.type==="ANNOUNCED"&&((o=r.info)==null?void 0:o.rdns)===((n=this.wallet)==null?void 0:n.rdns)||r.type==="INJECTED"||r.name===((s=this.wallet)==null?void 0:s.name)});if(i)await k.connectExternal(i,i.chain);else throw new Error("w3m-connecting-wc-browser: No connector found");_n.close()}catch(e){e instanceof Sn&&e.originalName===Tn.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?H.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:e.message}}):H.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:(e==null?void 0:e.message)??"Unknown"}}),this.error=!0}}};Ft=hi([N("w3m-connecting-wc-browser")],Ft);var fi=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Vt=class extends q{constructor(){var e;if(super(),!this.wallet)throw new Error("w3m-connecting-wc-desktop: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onRender=this.onRenderProxy.bind(this),H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"desktop",displayIndex:(e=this.wallet)==null?void 0:e.display_index,walletRank:this.wallet.order,view:B.state.view}})}onRenderProxy(){var e;!this.ready&&this.uri&&(this.ready=!0,(e=this.onConnect)==null||e.call(this))}onConnectProxy(){var e;if((e=this.wallet)!=null&&e.desktop_link&&this.uri)try{this.error=!1;const{desktop_link:i,name:r}=this.wallet,{redirect:o,href:n}=M.formatNativeUrl(i,this.uri);k.setWcLinking({name:r,href:n}),k.setRecentWallet(this.wallet),M.openHref(o,"_blank")}catch{this.error=!0}}};Vt=fi([N("w3m-connecting-wc-desktop")],Vt);var Ie=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let we=class extends q{constructor(){var e;if(super(),this.btnLabelTimeout=void 0,this.redirectDeeplink=void 0,this.redirectUniversalLink=void 0,this.target=void 0,this.preferUniversalLinks=z.state.experimental_preferUniversalLinks,this.isLoading=!0,this.onConnect=()=>{Gn.onConnectMobile(this.wallet)},!this.wallet)throw new Error("w3m-connecting-wc-mobile: No wallet provided");this.secondaryBtnLabel="Open",this.secondaryLabel=In.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.onHandleURI(),this.unsubscribe.push(k.subscribeKey("wcUri",()=>{this.onHandleURI()})),H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"mobile",displayIndex:(e=this.wallet)==null?void 0:e.display_index,walletRank:this.wallet.order,view:B.state.view}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.btnLabelTimeout)}onHandleURI(){var e;this.isLoading=!this.uri,!this.ready&&this.uri&&(this.ready=!0,(e=this.onConnect)==null||e.call(this))}onTryAgain(){var e;k.setWcError(!1),(e=this.onConnect)==null||e.call(this)}};Ie([P()],we.prototype,"redirectDeeplink",void 0);Ie([P()],we.prototype,"redirectUniversalLink",void 0);Ie([P()],we.prototype,"target",void 0);Ie([P()],we.prototype,"preferUniversalLinks",void 0);Ie([P()],we.prototype,"isLoading",void 0);we=Ie([N("w3m-connecting-wc-mobile")],we);var Ee={},rt,Ht;function pi(){return Ht||(Ht=1,rt=function(){return typeof Promise=="function"&&Promise.prototype&&Promise.prototype.then}),rt}var ot={},ce={},Kt;function ve(){if(Kt)return ce;Kt=1;let t;const e=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];return ce.getSymbolSize=function(r){if(!r)throw new Error('"version" cannot be null or undefined');if(r<1||r>40)throw new Error('"version" should be in range from 1 to 40');return r*4+17},ce.getSymbolTotalCodewords=function(r){return e[r]},ce.getBCHDigit=function(i){let r=0;for(;i!==0;)r++,i>>>=1;return r},ce.setToSJISFunction=function(r){if(typeof r!="function")throw new Error('"toSJISFunc" is not a valid function.');t=r},ce.isKanjiModeEnabled=function(){return typeof t<"u"},ce.toSJIS=function(r){return t(r)},ce}var st={},Gt;function kt(){return Gt||(Gt=1,(function(t){t.L={bit:1},t.M={bit:0},t.Q={bit:3},t.H={bit:2};function e(i){if(typeof i!="string")throw new Error("Param is not a string");switch(i.toLowerCase()){case"l":case"low":return t.L;case"m":case"medium":return t.M;case"q":case"quartile":return t.Q;case"h":case"high":return t.H;default:throw new Error("Unknown EC Level: "+i)}}t.isValid=function(r){return r&&typeof r.bit<"u"&&r.bit>=0&&r.bit<4},t.from=function(r,o){if(t.isValid(r))return r;try{return e(r)}catch{return o}}})(st)),st}var at,Qt;function gi(){if(Qt)return at;Qt=1;function t(){this.buffer=[],this.length=0}return t.prototype={get:function(e){const i=Math.floor(e/8);return(this.buffer[i]>>>7-e%8&1)===1},put:function(e,i){for(let r=0;r<i;r++)this.putBit((e>>>i-r-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(e){const i=Math.floor(this.length/8);this.buffer.length<=i&&this.buffer.push(0),e&&(this.buffer[i]|=128>>>this.length%8),this.length++}},at=t,at}var lt,Jt;function wi(){if(Jt)return lt;Jt=1;function t(e){if(!e||e<1)throw new Error("BitMatrix size must be defined and greater than 0");this.size=e,this.data=new Uint8Array(e*e),this.reservedBit=new Uint8Array(e*e)}return t.prototype.set=function(e,i,r,o){const n=e*this.size+i;this.data[n]=r,o&&(this.reservedBit[n]=!0)},t.prototype.get=function(e,i){return this.data[e*this.size+i]},t.prototype.xor=function(e,i,r){this.data[e*this.size+i]^=r},t.prototype.isReserved=function(e,i){return this.reservedBit[e*this.size+i]},lt=t,lt}var ct={},Yt;function mi(){return Yt||(Yt=1,(function(t){const e=ve().getSymbolSize;t.getRowColCoords=function(r){if(r===1)return[];const o=Math.floor(r/7)+2,n=e(r),s=n===145?26:Math.ceil((n-13)/(2*o-2))*2,a=[n-7];for(let l=1;l<o-1;l++)a[l]=a[l-1]-s;return a.push(6),a.reverse()},t.getPositions=function(r){const o=[],n=t.getRowColCoords(r),s=n.length;for(let a=0;a<s;a++)for(let l=0;l<s;l++)a===0&&l===0||a===0&&l===s-1||a===s-1&&l===0||o.push([n[a],n[l]]);return o}})(ct)),ct}var ut={},Xt;function bi(){if(Xt)return ut;Xt=1;const t=ve().getSymbolSize,e=7;return ut.getPositions=function(r){const o=t(r);return[[0,0],[o-e,0],[0,o-e]]},ut}var dt={},Zt;function yi(){return Zt||(Zt=1,(function(t){t.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};const e={N1:3,N2:3,N3:40,N4:10};t.isValid=function(o){return o!=null&&o!==""&&!isNaN(o)&&o>=0&&o<=7},t.from=function(o){return t.isValid(o)?parseInt(o,10):void 0},t.getPenaltyN1=function(o){const n=o.size;let s=0,a=0,l=0,c=null,d=null;for(let C=0;C<n;C++){a=l=0,c=d=null;for(let b=0;b<n;b++){let h=o.get(C,b);h===c?a++:(a>=5&&(s+=e.N1+(a-5)),c=h,a=1),h=o.get(b,C),h===d?l++:(l>=5&&(s+=e.N1+(l-5)),d=h,l=1)}a>=5&&(s+=e.N1+(a-5)),l>=5&&(s+=e.N1+(l-5))}return s},t.getPenaltyN2=function(o){const n=o.size;let s=0;for(let a=0;a<n-1;a++)for(let l=0;l<n-1;l++){const c=o.get(a,l)+o.get(a,l+1)+o.get(a+1,l)+o.get(a+1,l+1);(c===4||c===0)&&s++}return s*e.N2},t.getPenaltyN3=function(o){const n=o.size;let s=0,a=0,l=0;for(let c=0;c<n;c++){a=l=0;for(let d=0;d<n;d++)a=a<<1&2047|o.get(c,d),d>=10&&(a===1488||a===93)&&s++,l=l<<1&2047|o.get(d,c),d>=10&&(l===1488||l===93)&&s++}return s*e.N3},t.getPenaltyN4=function(o){let n=0;const s=o.data.length;for(let l=0;l<s;l++)n+=o.data[l];return Math.abs(Math.ceil(n*100/s/5)-10)*e.N4};function i(r,o,n){switch(r){case t.Patterns.PATTERN000:return(o+n)%2===0;case t.Patterns.PATTERN001:return o%2===0;case t.Patterns.PATTERN010:return n%3===0;case t.Patterns.PATTERN011:return(o+n)%3===0;case t.Patterns.PATTERN100:return(Math.floor(o/2)+Math.floor(n/3))%2===0;case t.Patterns.PATTERN101:return o*n%2+o*n%3===0;case t.Patterns.PATTERN110:return(o*n%2+o*n%3)%2===0;case t.Patterns.PATTERN111:return(o*n%3+(o+n)%2)%2===0;default:throw new Error("bad maskPattern:"+r)}}t.applyMask=function(o,n){const s=n.size;for(let a=0;a<s;a++)for(let l=0;l<s;l++)n.isReserved(l,a)||n.xor(l,a,i(o,l,a))},t.getBestMask=function(o,n){const s=Object.keys(t.Patterns).length;let a=0,l=1/0;for(let c=0;c<s;c++){n(c),t.applyMask(c,o);const d=t.getPenaltyN1(o)+t.getPenaltyN2(o)+t.getPenaltyN3(o)+t.getPenaltyN4(o);t.applyMask(c,o),d<l&&(l=d,a=c)}return a}})(dt)),dt}var De={},en;function Bn(){if(en)return De;en=1;const t=kt(),e=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],i=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];return De.getBlocksCount=function(o,n){switch(n){case t.L:return e[(o-1)*4+0];case t.M:return e[(o-1)*4+1];case t.Q:return e[(o-1)*4+2];case t.H:return e[(o-1)*4+3];default:return}},De.getTotalCodewordsCount=function(o,n){switch(n){case t.L:return i[(o-1)*4+0];case t.M:return i[(o-1)*4+1];case t.Q:return i[(o-1)*4+2];case t.H:return i[(o-1)*4+3];default:return}},De}var ht={},Pe={},tn;function vi(){if(tn)return Pe;tn=1;const t=new Uint8Array(512),e=new Uint8Array(256);return(function(){let r=1;for(let o=0;o<255;o++)t[o]=r,e[r]=o,r<<=1,r&256&&(r^=285);for(let o=255;o<512;o++)t[o]=t[o-255]})(),Pe.log=function(r){if(r<1)throw new Error("log("+r+")");return e[r]},Pe.exp=function(r){return t[r]},Pe.mul=function(r,o){return r===0||o===0?0:t[e[r]+e[o]]},Pe}var nn;function $i(){return nn||(nn=1,(function(t){const e=vi();t.mul=function(r,o){const n=new Uint8Array(r.length+o.length-1);for(let s=0;s<r.length;s++)for(let a=0;a<o.length;a++)n[s+a]^=e.mul(r[s],o[a]);return n},t.mod=function(r,o){let n=new Uint8Array(r);for(;n.length-o.length>=0;){const s=n[0];for(let l=0;l<o.length;l++)n[l]^=e.mul(o[l],s);let a=0;for(;a<n.length&&n[a]===0;)a++;n=n.slice(a)}return n},t.generateECPolynomial=function(r){let o=new Uint8Array([1]);for(let n=0;n<r;n++)o=t.mul(o,new Uint8Array([1,e.exp(n)]));return o}})(ht)),ht}var ft,rn;function Ci(){if(rn)return ft;rn=1;const t=$i();function e(i){this.genPoly=void 0,this.degree=i,this.degree&&this.initialize(this.degree)}return e.prototype.initialize=function(r){this.degree=r,this.genPoly=t.generateECPolynomial(this.degree)},e.prototype.encode=function(r){if(!this.genPoly)throw new Error("Encoder not initialized");const o=new Uint8Array(r.length+this.degree);o.set(r);const n=t.mod(o,this.genPoly),s=this.degree-n.length;if(s>0){const a=new Uint8Array(this.degree);return a.set(n,s),a}return n},ft=e,ft}var pt={},gt={},wt={},on;function kn(){return on||(on=1,wt.isValid=function(e){return!isNaN(e)&&e>=1&&e<=40}),wt}var Z={},sn;function Ln(){if(sn)return Z;sn=1;const t="[0-9]+",e="[A-Z $%*+\\-./:]+";let i="(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";i=i.replace(/u/g,"\\u");const r="(?:(?![A-Z0-9 $%*+\\-./:]|"+i+`)(?:.|[\r
]))+`;Z.KANJI=new RegExp(i,"g"),Z.BYTE_KANJI=new RegExp("[^A-Z0-9 $%*+\\-./:]+","g"),Z.BYTE=new RegExp(r,"g"),Z.NUMERIC=new RegExp(t,"g"),Z.ALPHANUMERIC=new RegExp(e,"g");const o=new RegExp("^"+i+"$"),n=new RegExp("^"+t+"$"),s=new RegExp("^[A-Z0-9 $%*+\\-./:]+$");return Z.testKanji=function(l){return o.test(l)},Z.testNumeric=function(l){return n.test(l)},Z.testAlphanumeric=function(l){return s.test(l)},Z}var an;function $e(){return an||(an=1,(function(t){const e=kn(),i=Ln();t.NUMERIC={id:"Numeric",bit:1,ccBits:[10,12,14]},t.ALPHANUMERIC={id:"Alphanumeric",bit:2,ccBits:[9,11,13]},t.BYTE={id:"Byte",bit:4,ccBits:[8,16,16]},t.KANJI={id:"Kanji",bit:8,ccBits:[8,10,12]},t.MIXED={bit:-1},t.getCharCountIndicator=function(n,s){if(!n.ccBits)throw new Error("Invalid mode: "+n);if(!e.isValid(s))throw new Error("Invalid version: "+s);return s>=1&&s<10?n.ccBits[0]:s<27?n.ccBits[1]:n.ccBits[2]},t.getBestModeForData=function(n){return i.testNumeric(n)?t.NUMERIC:i.testAlphanumeric(n)?t.ALPHANUMERIC:i.testKanji(n)?t.KANJI:t.BYTE},t.toString=function(n){if(n&&n.id)return n.id;throw new Error("Invalid mode")},t.isValid=function(n){return n&&n.bit&&n.ccBits};function r(o){if(typeof o!="string")throw new Error("Param is not a string");switch(o.toLowerCase()){case"numeric":return t.NUMERIC;case"alphanumeric":return t.ALPHANUMERIC;case"kanji":return t.KANJI;case"byte":return t.BYTE;default:throw new Error("Unknown mode: "+o)}}t.from=function(n,s){if(t.isValid(n))return n;try{return r(n)}catch{return s}}})(gt)),gt}var ln;function xi(){return ln||(ln=1,(function(t){const e=ve(),i=Bn(),r=kt(),o=$e(),n=kn(),s=7973,a=e.getBCHDigit(s);function l(b,h,_){for(let m=1;m<=40;m++)if(h<=t.getCapacity(m,_,b))return m}function c(b,h){return o.getCharCountIndicator(b,h)+4}function d(b,h){let _=0;return b.forEach(function(m){const S=c(m.mode,h);_+=S+m.getBitsLength()}),_}function C(b,h){for(let _=1;_<=40;_++)if(d(b,_)<=t.getCapacity(_,h,o.MIXED))return _}t.from=function(h,_){return n.isValid(h)?parseInt(h,10):_},t.getCapacity=function(h,_,m){if(!n.isValid(h))throw new Error("Invalid QR Code version");typeof m>"u"&&(m=o.BYTE);const S=e.getSymbolTotalCodewords(h),w=i.getTotalCodewordsCount(h,_),g=(S-w)*8;if(m===o.MIXED)return g;const y=g-c(m,h);switch(m){case o.NUMERIC:return Math.floor(y/10*3);case o.ALPHANUMERIC:return Math.floor(y/11*2);case o.KANJI:return Math.floor(y/13);case o.BYTE:default:return Math.floor(y/8)}},t.getBestVersionForData=function(h,_){let m;const S=r.from(_,r.M);if(Array.isArray(h)){if(h.length>1)return C(h,S);if(h.length===0)return 1;m=h[0]}else m=h;return l(m.mode,m.getLength(),S)},t.getEncodedBits=function(h){if(!n.isValid(h)||h<7)throw new Error("Invalid QR Code version");let _=h<<12;for(;e.getBCHDigit(_)-a>=0;)_^=s<<e.getBCHDigit(_)-a;return h<<12|_}})(pt)),pt}var mt={},cn;function Ei(){if(cn)return mt;cn=1;const t=ve(),e=1335,i=21522,r=t.getBCHDigit(e);return mt.getEncodedBits=function(n,s){const a=n.bit<<3|s;let l=a<<10;for(;t.getBCHDigit(l)-r>=0;)l^=e<<t.getBCHDigit(l)-r;return(a<<10|l)^i},mt}var bt={},yt,un;function Ri(){if(un)return yt;un=1;const t=$e();function e(i){this.mode=t.NUMERIC,this.data=i.toString()}return e.getBitsLength=function(r){return 10*Math.floor(r/3)+(r%3?r%3*3+1:0)},e.prototype.getLength=function(){return this.data.length},e.prototype.getBitsLength=function(){return e.getBitsLength(this.data.length)},e.prototype.write=function(r){let o,n,s;for(o=0;o+3<=this.data.length;o+=3)n=this.data.substr(o,3),s=parseInt(n,10),r.put(s,10);const a=this.data.length-o;a>0&&(n=this.data.substr(o),s=parseInt(n,10),r.put(s,a*3+1))},yt=e,yt}var vt,dn;function _i(){if(dn)return vt;dn=1;const t=$e(),e=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];function i(r){this.mode=t.ALPHANUMERIC,this.data=r}return i.getBitsLength=function(o){return 11*Math.floor(o/2)+6*(o%2)},i.prototype.getLength=function(){return this.data.length},i.prototype.getBitsLength=function(){return i.getBitsLength(this.data.length)},i.prototype.write=function(o){let n;for(n=0;n+2<=this.data.length;n+=2){let s=e.indexOf(this.data[n])*45;s+=e.indexOf(this.data[n+1]),o.put(s,11)}this.data.length%2&&o.put(e.indexOf(this.data[n]),6)},vt=i,vt}var $t,hn;function Si(){return hn||(hn=1,$t=function(e){for(var i=[],r=e.length,o=0;o<r;o++){var n=e.charCodeAt(o);if(n>=55296&&n<=56319&&r>o+1){var s=e.charCodeAt(o+1);s>=56320&&s<=57343&&(n=(n-55296)*1024+s-56320+65536,o+=1)}if(n<128){i.push(n);continue}if(n<2048){i.push(n>>6|192),i.push(n&63|128);continue}if(n<55296||n>=57344&&n<65536){i.push(n>>12|224),i.push(n>>6&63|128),i.push(n&63|128);continue}if(n>=65536&&n<=1114111){i.push(n>>18|240),i.push(n>>12&63|128),i.push(n>>6&63|128),i.push(n&63|128);continue}i.push(239,191,189)}return new Uint8Array(i).buffer}),$t}var Ct,fn;function Ti(){if(fn)return Ct;fn=1;const t=Si(),e=$e();function i(r){this.mode=e.BYTE,typeof r=="string"&&(r=t(r)),this.data=new Uint8Array(r)}return i.getBitsLength=function(o){return o*8},i.prototype.getLength=function(){return this.data.length},i.prototype.getBitsLength=function(){return i.getBitsLength(this.data.length)},i.prototype.write=function(r){for(let o=0,n=this.data.length;o<n;o++)r.put(this.data[o],8)},Ct=i,Ct}var xt,pn;function Ii(){if(pn)return xt;pn=1;const t=$e(),e=ve();function i(r){this.mode=t.KANJI,this.data=r}return i.getBitsLength=function(o){return o*13},i.prototype.getLength=function(){return this.data.length},i.prototype.getBitsLength=function(){return i.getBitsLength(this.data.length)},i.prototype.write=function(r){let o;for(o=0;o<this.data.length;o++){let n=e.toSJIS(this.data[o]);if(n>=33088&&n<=40956)n-=33088;else if(n>=57408&&n<=60351)n-=49472;else throw new Error("Invalid SJIS character: "+this.data[o]+`
Make sure your charset is UTF-8`);n=(n>>>8&255)*192+(n&255),r.put(n,13)}},xt=i,xt}var Et={exports:{}},gn;function Ai(){return gn||(gn=1,(function(t){var e={single_source_shortest_paths:function(i,r,o){var n={},s={};s[r]=0;var a=e.PriorityQueue.make();a.push(r,0);for(var l,c,d,C,b,h,_,m,S;!a.empty();){l=a.pop(),c=l.value,C=l.cost,b=i[c]||{};for(d in b)b.hasOwnProperty(d)&&(h=b[d],_=C+h,m=s[d],S=typeof s[d]>"u",(S||m>_)&&(s[d]=_,a.push(d,_),n[d]=c))}if(typeof o<"u"&&typeof s[o]>"u"){var w=["Could not find a path from ",r," to ",o,"."].join("");throw new Error(w)}return n},extract_shortest_path_from_predecessor_list:function(i,r){for(var o=[],n=r;n;)o.push(n),i[n],n=i[n];return o.reverse(),o},find_path:function(i,r,o){var n=e.single_source_shortest_paths(i,r,o);return e.extract_shortest_path_from_predecessor_list(n,o)},PriorityQueue:{make:function(i){var r=e.PriorityQueue,o={},n;i=i||{};for(n in r)r.hasOwnProperty(n)&&(o[n]=r[n]);return o.queue=[],o.sorter=i.sorter||r.default_sorter,o},default_sorter:function(i,r){return i.cost-r.cost},push:function(i,r){var o={value:i,cost:r};this.queue.push(o),this.queue.sort(this.sorter)},pop:function(){return this.queue.shift()},empty:function(){return this.queue.length===0}}};t.exports=e})(Et)),Et.exports}var wn;function Pi(){return wn||(wn=1,(function(t){const e=$e(),i=Ri(),r=_i(),o=Ti(),n=Ii(),s=Ln(),a=ve(),l=Ai();function c(w){return unescape(encodeURIComponent(w)).length}function d(w,g,y){const f=[];let L;for(;(L=w.exec(y))!==null;)f.push({data:L[0],index:L.index,mode:g,length:L[0].length});return f}function C(w){const g=d(s.NUMERIC,e.NUMERIC,w),y=d(s.ALPHANUMERIC,e.ALPHANUMERIC,w);let f,L;return a.isKanjiModeEnabled()?(f=d(s.BYTE,e.BYTE,w),L=d(s.KANJI,e.KANJI,w)):(f=d(s.BYTE_KANJI,e.BYTE,w),L=[]),g.concat(y,f,L).sort(function(T,R){return T.index-R.index}).map(function(T){return{data:T.data,mode:T.mode,length:T.length}})}function b(w,g){switch(g){case e.NUMERIC:return i.getBitsLength(w);case e.ALPHANUMERIC:return r.getBitsLength(w);case e.KANJI:return n.getBitsLength(w);case e.BYTE:return o.getBitsLength(w)}}function h(w){return w.reduce(function(g,y){const f=g.length-1>=0?g[g.length-1]:null;return f&&f.mode===y.mode?(g[g.length-1].data+=y.data,g):(g.push(y),g)},[])}function _(w){const g=[];for(let y=0;y<w.length;y++){const f=w[y];switch(f.mode){case e.NUMERIC:g.push([f,{data:f.data,mode:e.ALPHANUMERIC,length:f.length},{data:f.data,mode:e.BYTE,length:f.length}]);break;case e.ALPHANUMERIC:g.push([f,{data:f.data,mode:e.BYTE,length:f.length}]);break;case e.KANJI:g.push([f,{data:f.data,mode:e.BYTE,length:c(f.data)}]);break;case e.BYTE:g.push([{data:f.data,mode:e.BYTE,length:c(f.data)}])}}return g}function m(w,g){const y={},f={start:{}};let L=["start"];for(let $=0;$<w.length;$++){const T=w[$],R=[];for(let v=0;v<T.length;v++){const A=T[v],x=""+$+v;R.push(x),y[x]={node:A,lastCount:0},f[x]={};for(let I=0;I<L.length;I++){const E=L[I];y[E]&&y[E].node.mode===A.mode?(f[E][x]=b(y[E].lastCount+A.length,A.mode)-b(y[E].lastCount,A.mode),y[E].lastCount+=A.length):(y[E]&&(y[E].lastCount=A.length),f[E][x]=b(A.length,A.mode)+4+e.getCharCountIndicator(A.mode,g))}}L=R}for(let $=0;$<L.length;$++)f[L[$]].end=0;return{map:f,table:y}}function S(w,g){let y;const f=e.getBestModeForData(w);if(y=e.from(g,f),y!==e.BYTE&&y.bit<f.bit)throw new Error('"'+w+'" cannot be encoded with mode '+e.toString(y)+`.
 Suggested mode is: `+e.toString(f));switch(y===e.KANJI&&!a.isKanjiModeEnabled()&&(y=e.BYTE),y){case e.NUMERIC:return new i(w);case e.ALPHANUMERIC:return new r(w);case e.KANJI:return new n(w);case e.BYTE:return new o(w)}}t.fromArray=function(g){return g.reduce(function(y,f){return typeof f=="string"?y.push(S(f,null)):f.data&&y.push(S(f.data,f.mode)),y},[])},t.fromString=function(g,y){const f=C(g,a.isKanjiModeEnabled()),L=_(f),$=m(L,y),T=l.find_path($.map,"start","end"),R=[];for(let v=1;v<T.length-1;v++)R.push($.table[T[v]].node);return t.fromArray(h(R))},t.rawSplit=function(g){return t.fromArray(C(g,a.isKanjiModeEnabled()))}})(bt)),bt}var mn;function Wi(){if(mn)return ot;mn=1;const t=ve(),e=kt(),i=gi(),r=wi(),o=mi(),n=bi(),s=yi(),a=Bn(),l=Ci(),c=xi(),d=Ei(),C=$e(),b=Pi();function h($,T){const R=$.size,v=n.getPositions(T);for(let A=0;A<v.length;A++){const x=v[A][0],I=v[A][1];for(let E=-1;E<=7;E++)if(!(x+E<=-1||R<=x+E))for(let W=-1;W<=7;W++)I+W<=-1||R<=I+W||(E>=0&&E<=6&&(W===0||W===6)||W>=0&&W<=6&&(E===0||E===6)||E>=2&&E<=4&&W>=2&&W<=4?$.set(x+E,I+W,!0,!0):$.set(x+E,I+W,!1,!0))}}function _($){const T=$.size;for(let R=8;R<T-8;R++){const v=R%2===0;$.set(R,6,v,!0),$.set(6,R,v,!0)}}function m($,T){const R=o.getPositions(T);for(let v=0;v<R.length;v++){const A=R[v][0],x=R[v][1];for(let I=-2;I<=2;I++)for(let E=-2;E<=2;E++)I===-2||I===2||E===-2||E===2||I===0&&E===0?$.set(A+I,x+E,!0,!0):$.set(A+I,x+E,!1,!0)}}function S($,T){const R=$.size,v=c.getEncodedBits(T);let A,x,I;for(let E=0;E<18;E++)A=Math.floor(E/3),x=E%3+R-8-3,I=(v>>E&1)===1,$.set(A,x,I,!0),$.set(x,A,I,!0)}function w($,T,R){const v=$.size,A=d.getEncodedBits(T,R);let x,I;for(x=0;x<15;x++)I=(A>>x&1)===1,x<6?$.set(x,8,I,!0):x<8?$.set(x+1,8,I,!0):$.set(v-15+x,8,I,!0),x<8?$.set(8,v-x-1,I,!0):x<9?$.set(8,15-x-1+1,I,!0):$.set(8,15-x-1,I,!0);$.set(v-8,8,1,!0)}function g($,T){const R=$.size;let v=-1,A=R-1,x=7,I=0;for(let E=R-1;E>0;E-=2)for(E===6&&E--;;){for(let W=0;W<2;W++)if(!$.isReserved(A,E-W)){let le=!1;I<T.length&&(le=(T[I]>>>x&1)===1),$.set(A,E-W,le),x--,x===-1&&(I++,x=7)}if(A+=v,A<0||R<=A){A-=v,v=-v;break}}}function y($,T,R){const v=new i;R.forEach(function(W){v.put(W.mode.bit,4),v.put(W.getLength(),C.getCharCountIndicator(W.mode,$)),W.write(v)});const A=t.getSymbolTotalCodewords($),x=a.getTotalCodewordsCount($,T),I=(A-x)*8;for(v.getLengthInBits()+4<=I&&v.put(0,4);v.getLengthInBits()%8!==0;)v.putBit(0);const E=(I-v.getLengthInBits())/8;for(let W=0;W<E;W++)v.put(W%2?17:236,8);return f(v,$,T)}function f($,T,R){const v=t.getSymbolTotalCodewords(T),A=a.getTotalCodewordsCount(T,R),x=v-A,I=a.getBlocksCount(T,R),E=v%I,W=I-E,le=Math.floor(v/I),Ae=Math.floor(x/I),zn=Ae+1,Dt=le-Ae,Fn=new l(Dt);let et=0;const Oe=new Array(I),jt=new Array(I);let tt=0;const Vn=new Uint8Array($.buffer);for(let xe=0;xe<I;xe++){const it=xe<W?Ae:zn;Oe[xe]=Vn.slice(et,et+it),jt[xe]=Fn.encode(Oe[xe]),et+=it,tt=Math.max(tt,it)}const nt=new Uint8Array(v);let Ut=0,ie,re;for(ie=0;ie<tt;ie++)for(re=0;re<I;re++)ie<Oe[re].length&&(nt[Ut++]=Oe[re][ie]);for(ie=0;ie<Dt;ie++)for(re=0;re<I;re++)nt[Ut++]=jt[re][ie];return nt}function L($,T,R,v){let A;if(Array.isArray($))A=b.fromArray($);else if(typeof $=="string"){let le=T;if(!le){const Ae=b.rawSplit($);le=c.getBestVersionForData(Ae,R)}A=b.fromString($,le||40)}else throw new Error("Invalid data");const x=c.getBestVersionForData(A,R);if(!x)throw new Error("The amount of data is too big to be stored in a QR Code");if(!T)T=x;else if(T<x)throw new Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+x+`.
`);const I=y(T,R,A),E=t.getSymbolSize(T),W=new r(E);return h(W,T),_(W),m(W,T),w(W,R,0),T>=7&&S(W,T),g(W,I),isNaN(v)&&(v=s.getBestMask(W,w.bind(null,W,R))),s.applyMask(v,W),w(W,R,v),{modules:W,version:T,errorCorrectionLevel:R,maskPattern:v,segments:A}}return ot.create=function(T,R){if(typeof T>"u"||T==="")throw new Error("No input text");let v=e.M,A,x;return typeof R<"u"&&(v=e.from(R.errorCorrectionLevel,e.M),A=c.from(R.version),x=s.from(R.maskPattern),R.toSJISFunc&&t.setToSJISFunction(R.toSJISFunc)),L(T,A,v,x)},ot}var Rt={},_t={},bn;function Nn(){return bn||(bn=1,(function(t){function e(i){if(typeof i=="number"&&(i=i.toString()),typeof i!="string")throw new Error("Color should be defined as hex string");let r=i.slice().replace("#","").split("");if(r.length<3||r.length===5||r.length>8)throw new Error("Invalid hex color: "+i);(r.length===3||r.length===4)&&(r=Array.prototype.concat.apply([],r.map(function(n){return[n,n]}))),r.length===6&&r.push("F","F");const o=parseInt(r.join(""),16);return{r:o>>24&255,g:o>>16&255,b:o>>8&255,a:o&255,hex:"#"+r.slice(0,6).join("")}}t.getOptions=function(r){r||(r={}),r.color||(r.color={});const o=typeof r.margin>"u"||r.margin===null||r.margin<0?4:r.margin,n=r.width&&r.width>=21?r.width:void 0,s=r.scale||4;return{width:n,scale:n?4:s,margin:o,color:{dark:e(r.color.dark||"#000000ff"),light:e(r.color.light||"#ffffffff")},type:r.type,rendererOpts:r.rendererOpts||{}}},t.getScale=function(r,o){return o.width&&o.width>=r+o.margin*2?o.width/(r+o.margin*2):o.scale},t.getImageWidth=function(r,o){const n=t.getScale(r,o);return Math.floor((r+o.margin*2)*n)},t.qrToImageData=function(r,o,n){const s=o.modules.size,a=o.modules.data,l=t.getScale(s,n),c=Math.floor((s+n.margin*2)*l),d=n.margin*l,C=[n.color.light,n.color.dark];for(let b=0;b<c;b++)for(let h=0;h<c;h++){let _=(b*c+h)*4,m=n.color.light;if(b>=d&&h>=d&&b<c-d&&h<c-d){const S=Math.floor((b-d)/l),w=Math.floor((h-d)/l);m=C[a[S*s+w]?1:0]}r[_++]=m.r,r[_++]=m.g,r[_++]=m.b,r[_]=m.a}}})(_t)),_t}var yn;function Bi(){return yn||(yn=1,(function(t){const e=Nn();function i(o,n,s){o.clearRect(0,0,n.width,n.height),n.style||(n.style={}),n.height=s,n.width=s,n.style.height=s+"px",n.style.width=s+"px"}function r(){try{return document.createElement("canvas")}catch{throw new Error("You need to specify a canvas element")}}t.render=function(n,s,a){let l=a,c=s;typeof l>"u"&&(!s||!s.getContext)&&(l=s,s=void 0),s||(c=r()),l=e.getOptions(l);const d=e.getImageWidth(n.modules.size,l),C=c.getContext("2d"),b=C.createImageData(d,d);return e.qrToImageData(b.data,n,l),i(C,c,d),C.putImageData(b,0,0),c},t.renderToDataURL=function(n,s,a){let l=a;typeof l>"u"&&(!s||!s.getContext)&&(l=s,s=void 0),l||(l={});const c=t.render(n,s,l),d=l.type||"image/png",C=l.rendererOpts||{};return c.toDataURL(d,C.quality)}})(Rt)),Rt}var St={},vn;function ki(){if(vn)return St;vn=1;const t=Nn();function e(o,n){const s=o.a/255,a=n+'="'+o.hex+'"';return s<1?a+" "+n+'-opacity="'+s.toFixed(2).slice(1)+'"':a}function i(o,n,s){let a=o+n;return typeof s<"u"&&(a+=" "+s),a}function r(o,n,s){let a="",l=0,c=!1,d=0;for(let C=0;C<o.length;C++){const b=Math.floor(C%n),h=Math.floor(C/n);!b&&!c&&(c=!0),o[C]?(d++,C>0&&b>0&&o[C-1]||(a+=c?i("M",b+s,.5+h+s):i("m",l,0),l=0,c=!1),b+1<n&&o[C+1]||(a+=i("h",d),d=0)):l++}return a}return St.render=function(n,s,a){const l=t.getOptions(s),c=n.modules.size,d=n.modules.data,C=c+l.margin*2,b=l.color.light.a?"<path "+e(l.color.light,"fill")+' d="M0 0h'+C+"v"+C+'H0z"/>':"",h="<path "+e(l.color.dark,"stroke")+' d="'+r(d,c,l.margin)+'"/>',_='viewBox="0 0 '+C+" "+C+'"',S='<svg xmlns="http://www.w3.org/2000/svg" '+(l.width?'width="'+l.width+'" height="'+l.width+'" ':"")+_+' shape-rendering="crispEdges">'+b+h+`</svg>
`;return typeof a=="function"&&a(null,S),S},St}var $n;function Li(){if($n)return Ee;$n=1;const t=pi(),e=Wi(),i=Bi(),r=ki();function o(n,s,a,l,c){const d=[].slice.call(arguments,1),C=d.length,b=typeof d[C-1]=="function";if(!b&&!t())throw new Error("Callback required as last argument");if(b){if(C<2)throw new Error("Too few arguments provided");C===2?(c=a,a=s,s=l=void 0):C===3&&(s.getContext&&typeof c>"u"?(c=l,l=void 0):(c=l,l=a,a=s,s=void 0))}else{if(C<1)throw new Error("Too few arguments provided");return C===1?(a=s,s=l=void 0):C===2&&!s.getContext&&(l=a,a=s,s=void 0),new Promise(function(h,_){try{const m=e.create(a,l);h(n(m,s,l))}catch(m){_(m)}})}try{const h=e.create(a,l);c(null,n(h,s,l))}catch(h){c(h)}}return Ee.create=e.create,Ee.toCanvas=o.bind(null,i.render),Ee.toDataURL=o.bind(null,i.renderToDataURL),Ee.toString=o.bind(null,function(n,s,a){return r.render(n,a)}),Ee}var Ni=Li();const Mi=ni(Ni),Oi=.1,Cn=2.5,oe=7;function Tt(t,e,i){return t===e?!1:(t-e<0?e-t:t-e)<=i+Oi}function Di(t,e){const i=Array.prototype.slice.call(Mi.create(t,{errorCorrectionLevel:e}).modules.data,0),r=Math.sqrt(i.length);return i.reduce((o,n,s)=>(s%r===0?o.push([n]):o[o.length-1].push(n))&&o,[])}const ji={generate({uri:t,size:e,logoSize:i,padding:r=8,dotColor:o="var(--apkt-colors-black)"}){const s=[],a=Di(t,"Q"),l=(e-2*r)/a.length,c=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];c.forEach(({x:m,y:S})=>{const w=(a.length-oe)*l*m+r,g=(a.length-oe)*l*S+r,y=.45;for(let f=0;f<c.length;f+=1){const L=l*(oe-f*2);s.push(Ue`
            <rect
              fill=${f===2?"var(--apkt-colors-black)":"var(--apkt-colors-white)"}
              width=${f===0?L-10:L}
              rx= ${f===0?(L-10)*y:L*y}
              ry= ${f===0?(L-10)*y:L*y}
              stroke=${o}
              stroke-width=${f===0?10:0}
              height=${f===0?L-10:L}
              x= ${f===0?g+l*f+10/2:g+l*f}
              y= ${f===0?w+l*f+10/2:w+l*f}
            />
          `)}});const d=Math.floor((i+25)/l),C=a.length/2-d/2,b=a.length/2+d/2-1,h=[];a.forEach((m,S)=>{m.forEach((w,g)=>{if(a[S][g]&&!(S<oe&&g<oe||S>a.length-(oe+1)&&g<oe||S<oe&&g>a.length-(oe+1))&&!(S>C&&S<b&&g>C&&g<b)){const y=S*l+l/2+r,f=g*l+l/2+r;h.push([y,f])}})});const _={};return h.forEach(([m,S])=>{var w;_[m]?(w=_[m])==null||w.push(S):_[m]=[S]}),Object.entries(_).map(([m,S])=>{const w=S.filter(g=>S.every(y=>!Tt(g,y,l)));return[Number(m),w]}).forEach(([m,S])=>{S.forEach(w=>{s.push(Ue`<circle cx=${m} cy=${w} fill=${o} r=${l/Cn} />`)})}),Object.entries(_).filter(([m,S])=>S.length>1).map(([m,S])=>{const w=S.filter(g=>S.some(y=>Tt(g,y,l)));return[Number(m),w]}).map(([m,S])=>{S.sort((g,y)=>g<y?-1:1);const w=[];for(const g of S){const y=w.find(f=>f.some(L=>Tt(g,L,l)));y?y.push(g):w.push([g])}return[m,w.map(g=>[g[0],g[g.length-1]])]}).forEach(([m,S])=>{S.forEach(([w,g])=>{s.push(Ue`
              <line
                x1=${m}
                x2=${m}
                y1=${w}
                y2=${g}
                stroke=${o}
                stroke-width=${l/(Cn/2)}
                stroke-linecap="round"
              />
            `)})}),s}},Ui=U`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:t})=>t.white};
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:t})=>t[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:t})=>t.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:t})=>t.theme.backgroundPrimary};
    border-radius: ${({borderRadius:t})=>t[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:t})=>t[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`;var he=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let te=class extends O{constructor(){super(...arguments),this.uri="",this.size=500,this.theme="dark",this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),u`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return Ue`
      <svg viewBox="0 0 ${this.size} ${this.size}" width="100%" height="100%">
        ${ji.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?u`<wui-image src=${this.imageSrc} alt=${this.alt??"logo"}></wui-image>`:this.farcaster?u`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:u`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};te.styles=[Y,Ui];he([p()],te.prototype,"uri",void 0);he([p({type:Number})],te.prototype,"size",void 0);he([p()],te.prototype,"theme",void 0);he([p()],te.prototype,"imageSrc",void 0);he([p()],te.prototype,"alt",void 0);he([p({type:Boolean})],te.prototype,"arenaClear",void 0);he([p({type:Boolean})],te.prototype,"farcaster",void 0);te=he([N("wui-qr-code")],te);const qi=U`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:t})=>t[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:t})=>t.xl};
    animation-timing-function: ${({easings:t})=>t["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var Mn=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Ve=class extends q{constructor(){super(),this.basic=!1}firstUpdated(){var e,i,r;this.basic||H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:((e=this.wallet)==null?void 0:e.name)??"WalletConnect",platform:"qrcode",displayIndex:(i=this.wallet)==null?void 0:i.display_index,walletRank:(r=this.wallet)==null?void 0:r.order,view:B.state.view}})}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this.unsubscribe)==null||e.forEach(i=>i())}render(){return this.onRenderProxy(),u`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["0","5","5","5"]}
        gap="5"
      >
        <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>
        <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
        ${this.copyTemplate()}
      </wui-flex>
      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}onRenderProxy(){!this.ready&&this.uri&&(this.ready=!0)}qrCodeTemplate(){if(!this.uri||!this.ready)return null;const e=this.wallet?this.wallet.name:void 0;k.setWcLinking(void 0),k.setRecentWallet(this.wallet);const i=je.state.themeVariables["--apkt-qr-color"]??je.state.themeVariables["--w3m-qr-color"];return u` <wui-qr-code
      theme=${je.state.themeMode}
      uri=${this.uri}
      imageSrc=${D(ue.getWalletImage(this.wallet))}
      color=${D(i)}
      alt=${D(e)}
      data-testid="wui-qr-code"
    ></wui-qr-code>`}copyTemplate(){const e=!this.uri||!this.ready;return u`<wui-button
      .disabled=${e}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      Copy link
      <wui-icon size="sm" color="inherit" name="copy" slot="iconRight"></wui-icon>
    </wui-button>`}};Ve.styles=qi;Mn([p({type:Boolean})],Ve.prototype,"basic",void 0);Ve=Mn([N("w3m-connecting-wc-qrcode")],Ve);var zi=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let xn=class extends O{constructor(){var e,i,r;if(super(),this.wallet=(e=B.state.data)==null?void 0:e.wallet,!this.wallet)throw new Error("w3m-connecting-wc-unsupported: No wallet provided");H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:(i=this.wallet)==null?void 0:i.display_index,walletRank:(r=this.wallet)==null?void 0:r.order,view:B.state.view}})}render(){return u`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="5"
      >
        <wui-wallet-image
          size="lg"
          imageSrc=${D(ue.getWalletImage(this.wallet))}
        ></wui-wallet-image>

        <wui-text variant="md-regular" color="primary">Not Detected</wui-text>
      </wui-flex>

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}};xn=zi([N("w3m-connecting-wc-unsupported")],xn);var On=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Wt=class extends q{constructor(){var e,i;if(super(),this.isLoading=!0,!this.wallet)throw new Error("w3m-connecting-wc-web: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.secondaryBtnLabel="Open",this.secondaryLabel=In.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.updateLoadingState(),this.unsubscribe.push(k.subscribeKey("wcUri",()=>{this.updateLoadingState()})),H.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"web",displayIndex:(e=this.wallet)==null?void 0:e.display_index,walletRank:(i=this.wallet)==null?void 0:i.order,view:B.state.view}})}updateLoadingState(){this.isLoading=!this.uri}onConnectProxy(){var e;if((e=this.wallet)!=null&&e.webapp_link&&this.uri)try{this.error=!1;const{webapp_link:i,name:r}=this.wallet,{redirect:o,href:n}=M.formatUniversalUrl(i,this.uri);k.setWcLinking({name:r,href:n}),k.setRecentWallet(this.wallet),M.openHref(o,"_blank")}catch{this.error=!0}}};On([P()],Wt.prototype,"isLoading",void 0);Wt=On([N("w3m-connecting-wc-web")],Wt);const Fi=U`
  :host([data-mobile-fullscreen='true']) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :host([data-mobile-fullscreen='true']) wui-ux-by-reown {
    margin-top: auto;
  }
`;var Ce=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let ae=class extends O{constructor(){var e;super(),this.wallet=(e=B.state.data)==null?void 0:e.wallet,this.unsubscribe=[],this.platform=void 0,this.platforms=[],this.isSiwxEnabled=!!z.state.siwx,this.remoteFeatures=z.state.remoteFeatures,this.displayBranding=!0,this.basic=!1,this.determinePlatforms(),this.initializeConnection(),this.unsubscribe.push(z.subscribeKey("remoteFeatures",i=>this.remoteFeatures=i))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return z.state.enableMobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),u`
      ${this.headerTemplate()}
      <div class="platform-container">${this.platformTemplate()}</div>
      ${this.reownBrandingTemplate()}
    `}reownBrandingTemplate(){var e;return!((e=this.remoteFeatures)!=null&&e.reownBranding)||!this.displayBranding?null:u`<wui-ux-by-reown></wui-ux-by-reown>`}async initializeConnection(e=!1){var i,r;if(!(this.platform==="browser"||z.state.manualWCControl&&!e))try{const{wcPairingExpiry:o,status:n}=k.state,{redirectView:s}=B.state.data??{};if(e||z.state.enableEmbedded||M.isPairingExpired(o)||n==="connecting"){const a=k.getConnections(ee.state.activeChain),l=(i=this.remoteFeatures)==null?void 0:i.multiWallet,c=a.length>0;await k.connectWalletConnect({cache:"never"}),this.isSiwxEnabled||(c&&l?(B.replace("ProfileWallets"),Be.showSuccess("New Wallet Added")):s?B.replace(s):_n.close())}}catch(o){if(o instanceof Error&&o.message.includes("An error occurred when attempting to switch chain")&&!z.state.enableNetworkSwitch&&ee.state.activeChain){ee.setActiveCaipNetwork(Qn.getUnsupportedNetwork(`${ee.state.activeChain}:${(r=ee.state.activeCaipNetwork)==null?void 0:r.id}`)),ee.showUnsupportedChainUI();return}o instanceof Sn&&o.originalName===Tn.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?H.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:o.message}}):H.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:(o==null?void 0:o.message)??"Unknown"}}),k.setWcError(!0),Be.showError(o.message??"Connection error"),k.resetWcConnection(),B.goBack()}}determinePlatforms(){if(!this.wallet){this.platforms.push("qrcode"),this.platform="qrcode";return}if(this.platform)return;const{mobile_link:e,desktop_link:i,webapp_link:r,injected:o,rdns:n}=this.wallet,s=o==null?void 0:o.map(({injected_id:m})=>m).filter(Boolean),a=[...n?[n]:s??[]],l=z.state.isUniversalProvider?!1:a.length,c=e,d=r,C=k.checkInstalled(a),b=l&&C,h=i&&!M.isMobile();b&&!ee.state.noAdapters&&this.platforms.push("browser"),c&&this.platforms.push(M.isMobile()?"mobile":"qrcode"),d&&this.platforms.push("web"),h&&this.platforms.push("desktop");const _=Jn.isCustomDeeplinkWallet(this.wallet.id,ee.state.activeChain);!b&&l&&!ee.state.noAdapters&&!_&&this.platforms.push("unsupported"),this.platform=this.platforms[0]}platformTemplate(){switch(this.platform){case"browser":return u`<w3m-connecting-wc-browser></w3m-connecting-wc-browser>`;case"web":return u`<w3m-connecting-wc-web></w3m-connecting-wc-web>`;case"desktop":return u`
          <w3m-connecting-wc-desktop .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-desktop>
        `;case"mobile":return u`
          <w3m-connecting-wc-mobile isMobile .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-mobile>
        `;case"qrcode":return u`<w3m-connecting-wc-qrcode ?basic=${this.basic}></w3m-connecting-wc-qrcode>`;default:return u`<w3m-connecting-wc-unsupported></w3m-connecting-wc-unsupported>`}}headerTemplate(){return this.platforms.length>1?u`
      <w3m-connecting-header
        .platforms=${this.platforms}
        .onSelectPlatfrom=${this.onSelectPlatform.bind(this)}
      >
      </w3m-connecting-header>
    `:null}async onSelectPlatform(e){var r;const i=(r=this.shadowRoot)==null?void 0:r.querySelector("div");i&&(await i.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.platform=e,i.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}};ae.styles=Fi;Ce([P()],ae.prototype,"platform",void 0);Ce([P()],ae.prototype,"platforms",void 0);Ce([P()],ae.prototype,"isSiwxEnabled",void 0);Ce([P()],ae.prototype,"remoteFeatures",void 0);Ce([p({type:Boolean})],ae.prototype,"displayBranding",void 0);Ce([p({type:Boolean})],ae.prototype,"basic",void 0);ae=Ce([N("w3m-connecting-wc-view")],ae);var Lt=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let He=class extends O{constructor(){super(),this.unsubscribe=[],this.isMobile=M.isMobile(),this.remoteFeatures=z.state.remoteFeatures,this.unsubscribe.push(z.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){if(this.isMobile){const{featured:e,recommended:i}=j.state,{customWallets:r}=z.state,o=Yn.getRecentWallets(),n=e.length||i.length||(r==null?void 0:r.length)||o.length;return u`<wui-flex flexDirection="column" gap="2" .margin=${["1","3","3","3"]}>
        ${n?u`<w3m-connector-list></w3m-connector-list>`:null}
        <w3m-all-wallets-widget></w3m-all-wallets-widget>
      </wui-flex>`}return u`<wui-flex flexDirection="column" .padding=${["0","0","4","0"]}>
        <w3m-connecting-wc-view ?basic=${!0} .displayBranding=${!1}></w3m-connecting-wc-view>
        <wui-flex flexDirection="column" .padding=${["0","3","0","3"]}>
          <w3m-all-wallets-widget></w3m-all-wallets-widget>
        </wui-flex>
      </wui-flex>
      ${this.reownBrandingTemplate()} `}reownBrandingTemplate(){var e;return(e=this.remoteFeatures)!=null&&e.reownBranding?u` <wui-flex flexDirection="column" .padding=${["1","0","1","0"]}>
      <wui-ux-by-reown></wui-ux-by-reown>
    </wui-flex>`:null}};Lt([P()],He.prototype,"isMobile",void 0);Lt([P()],He.prototype,"remoteFeatures",void 0);He=Lt([N("w3m-connecting-wc-basic-view")],He);/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Vi=t=>t.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const We=(t,e)=>{var r;const i=t._$AN;if(i===void 0)return!1;for(const o of i)(r=o._$AO)==null||r.call(o,e,!1),We(o,e);return!0},Ke=t=>{let e,i;do{if((e=t._$AM)===void 0)break;i=e._$AN,i.delete(t),t=e}while((i==null?void 0:i.size)===0)},Dn=t=>{for(let e;e=t._$AM;t=e){let i=e._$AN;if(i===void 0)e._$AN=i=new Set;else if(i.has(t))break;i.add(t),Gi(e)}};function Hi(t){this._$AN!==void 0?(Ke(this),this._$AM=t,Dn(this)):this._$AM=t}function Ki(t,e=!1,i=0){const r=this._$AH,o=this._$AN;if(o!==void 0&&o.size!==0)if(e)if(Array.isArray(r))for(let n=i;n<r.length;n++)We(r[n],!1),Ke(r[n]);else r!=null&&(We(r,!1),Ke(r));else We(this,t)}const Gi=t=>{t.type==Zn.CHILD&&(t._$AP??(t._$AP=Ki),t._$AQ??(t._$AQ=Hi))};class Qi extends Xn{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,i,r){super._$AT(e,i,r),Dn(this),this.isConnected=e._$AU}_$AO(e,i=!0){var r,o;e!==this.isConnected&&(this.isConnected=e,e?(r=this.reconnected)==null||r.call(this):(o=this.disconnected)==null||o.call(this)),i&&(We(this,e),Ke(this))}setValue(e){if(Vi(this._$Ct))this._$Ct._$AI(e,this);else{const i=[...this._$Ct._$AH];i[this._$Ci]=e,this._$Ct._$AI(i,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Nt=()=>new Ji;class Ji{}const It=new WeakMap,Mt=ei(class extends Qi{render(t){return zt}update(t,[e]){var r;const i=e!==this.G;return i&&this.rt(void 0),(i||this.lt!==this.ct)&&(this.G=e,this.ht=(r=t.options)==null?void 0:r.host,this.rt(this.ct=t.element)),zt}rt(t){if(this.G!==void 0)if(this.isConnected||(t=void 0),typeof this.G=="function"){const e=this.ht??globalThis;let i=It.get(e);i===void 0&&(i=new WeakMap,It.set(e,i)),i.get(this.G)!==void 0&&this.G.call(this.ht,void 0),i.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){var t,e;return typeof this.G=="function"?(t=It.get(this.ht??globalThis))==null?void 0:t.get(this.G):(e=this.G)==null?void 0:e.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}}),Yi=U`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  label {
    position: relative;
    display: inline-block;
    user-select: none;
    transition:
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      border ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      box-shadow ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      width ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      height ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      transform ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      opacity ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({colors:t})=>t.neutrals300};
    border-radius: ${({borderRadius:t})=>t.round};
    border: 1px solid transparent;
    will-change: border;
    transition:
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      border ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      box-shadow ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      width ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      height ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      transform ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      opacity ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  span:before {
    content: '';
    position: absolute;
    background-color: ${({colors:t})=>t.white};
    border-radius: 50%;
  }

  /* -- Sizes --------------------------------------------------------- */
  label[data-size='lg'] {
    width: 48px;
    height: 32px;
  }

  label[data-size='md'] {
    width: 40px;
    height: 28px;
  }

  label[data-size='sm'] {
    width: 32px;
    height: 22px;
  }

  label[data-size='lg'] > span:before {
    height: 24px;
    width: 24px;
    left: 4px;
    top: 3px;
  }

  label[data-size='md'] > span:before {
    height: 20px;
    width: 20px;
    left: 4px;
    top: 3px;
  }

  label[data-size='sm'] > span:before {
    height: 16px;
    width: 16px;
    left: 3px;
    top: 2px;
  }

  /* -- Focus states --------------------------------------------------- */
  input:focus-visible:not(:checked) + span,
  input:focus:not(:checked) + span {
    border: 1px solid ${({tokens:t})=>t.core.iconAccentPrimary};
    background-color: ${({tokens:t})=>t.theme.textTertiary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  input:focus-visible:checked + span,
  input:focus:checked + span {
    border: 1px solid ${({tokens:t})=>t.core.iconAccentPrimary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  /* -- Checked states --------------------------------------------------- */
  input:checked + span {
    background-color: ${({tokens:t})=>t.core.iconAccentPrimary};
  }

  label[data-size='lg'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='md'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='sm'] > input:checked + span:before {
    transform: translateX(calc(100% - 7px));
  }

  /* -- Hover states ------------------------------------------------------- */
  label:hover > input:not(:checked):not(:disabled) + span {
    background-color: ${({colors:t})=>t.neutrals400};
  }

  label:hover > input:checked:not(:disabled) + span {
    background-color: ${({colors:t})=>t.accent080};
  }

  /* -- Disabled state --------------------------------------------------- */
  label:has(input:disabled) {
    pointer-events: none;
    user-select: none;
  }

  input:not(:checked):disabled + span {
    background-color: ${({colors:t})=>t.neutrals700};
  }

  input:checked:disabled + span {
    background-color: ${({colors:t})=>t.neutrals700};
  }

  input:not(:checked):disabled + span::before {
    background-color: ${({colors:t})=>t.neutrals400};
  }

  input:checked:disabled + span::before {
    background-color: ${({tokens:t})=>t.theme.textTertiary};
  }
`;var Ze=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let _e=class extends O{constructor(){super(...arguments),this.inputElementRef=Nt(),this.checked=!1,this.disabled=!1,this.size="md"}render(){return u`
      <label data-size=${this.size}>
        <input
          ${Mt(this.inputElementRef)}
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.dispatchChangeEvent.bind(this)}
        />
        <span></span>
      </label>
    `}dispatchChangeEvent(){var e;this.dispatchEvent(new CustomEvent("switchChange",{detail:(e=this.inputElementRef.value)==null?void 0:e.checked,bubbles:!0,composed:!0}))}};_e.styles=[Y,ye,Yi];Ze([p({type:Boolean})],_e.prototype,"checked",void 0);Ze([p({type:Boolean})],_e.prototype,"disabled",void 0);Ze([p()],_e.prototype,"size",void 0);_e=Ze([N("wui-toggle")],_e);const Xi=U`
  :host {
    height: auto;
  }

  :host > wui-flex {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: ${({spacing:t})=>t[2]};
    padding: ${({spacing:t})=>t[2]} ${({spacing:t})=>t[3]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[4]};
    box-shadow: inset 0 0 0 1px ${({tokens:t})=>t.theme.foregroundPrimary};
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color;
    cursor: pointer;
  }

  wui-switch {
    pointer-events: none;
  }
`;var jn=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Ge=class extends O{constructor(){super(...arguments),this.checked=!1}render(){return u`
      <wui-flex>
        <wui-icon size="xl" name="walletConnectBrown"></wui-icon>
        <wui-toggle
          ?checked=${this.checked}
          size="sm"
          @switchChange=${this.handleToggleChange.bind(this)}
        ></wui-toggle>
      </wui-flex>
    `}handleToggleChange(e){e.stopPropagation(),this.checked=e.detail,this.dispatchSwitchEvent()}dispatchSwitchEvent(){this.dispatchEvent(new CustomEvent("certifiedSwitchChange",{detail:this.checked,bubbles:!0,composed:!0}))}};Ge.styles=[Y,ye,Xi];jn([p({type:Boolean})],Ge.prototype,"checked",void 0);Ge=jn([N("wui-certified-switch")],Ge);const Zi=U`
  :host {
    position: relative;
    width: 100%;
    display: inline-flex;
    flex-direction: column;
    gap: ${({spacing:t})=>t[3]};
    color: ${({tokens:t})=>t.theme.textPrimary};
    caret-color: ${({tokens:t})=>t.core.textAccentPrimary};
  }

  .wui-input-text-container {
    position: relative;
    display: flex;
  }

  input {
    width: 100%;
    border-radius: ${({borderRadius:t})=>t[4]};
    color: inherit;
    background: transparent;
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
    caret-color: ${({tokens:t})=>t.core.textAccentPrimary};
    padding: ${({spacing:t})=>t[3]} ${({spacing:t})=>t[3]}
      ${({spacing:t})=>t[3]} ${({spacing:t})=>t[10]};
    font-size: ${({textSize:t})=>t.large};
    line-height: ${({typography:t})=>t["lg-regular"].lineHeight};
    letter-spacing: ${({typography:t})=>t["lg-regular"].letterSpacing};
    font-weight: ${({fontWeight:t})=>t.regular};
    font-family: ${({fontFamily:t})=>t.regular};
  }

  input[data-size='lg'] {
    padding: ${({spacing:t})=>t[4]} ${({spacing:t})=>t[3]}
      ${({spacing:t})=>t[4]} ${({spacing:t})=>t[10]};
  }

  @media (hover: hover) and (pointer: fine) {
    input:hover:enabled {
      border: 1px solid ${({tokens:t})=>t.theme.borderSecondary};
    }
  }

  input:disabled {
    cursor: unset;
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
  }

  input::placeholder {
    color: ${({tokens:t})=>t.theme.textSecondary};
  }

  input:focus:enabled {
    border: 1px solid ${({tokens:t})=>t.theme.borderSecondary};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    -webkit-box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
    -moz-box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
    box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
  }

  div.wui-input-text-container:has(input:disabled) {
    opacity: 0.5;
  }

  wui-icon.wui-input-text-left-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    left: ${({spacing:t})=>t[4]};
    color: ${({tokens:t})=>t.theme.iconDefault};
  }

  button.wui-input-text-submit-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:t})=>t[3]};
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: ${({borderRadius:t})=>t[2]};
    color: ${({tokens:t})=>t.core.textAccentPrimary};
  }

  button.wui-input-text-submit-button:disabled {
    opacity: 1;
  }

  button.wui-input-text-submit-button.loading wui-icon {
    animation: spin 1s linear infinite;
  }

  button.wui-input-text-submit-button:hover {
    background: ${({tokens:t})=>t.core.foregroundAccent010};
  }

  input:has(+ .wui-input-text-submit-button) {
    padding-right: ${({spacing:t})=>t[12]};
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }

  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /* -- Keyframes --------------------------------------------------- */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;var G=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let F=class extends O{constructor(){super(...arguments),this.inputElementRef=Nt(),this.disabled=!1,this.loading=!1,this.placeholder="",this.type="text",this.value="",this.size="md"}render(){return u` <div class="wui-input-text-container">
        ${this.templateLeftIcon()}
        <input
          data-size=${this.size}
          ${Mt(this.inputElementRef)}
          data-testid="wui-input-text"
          type=${this.type}
          enterkeyhint=${D(this.enterKeyHint)}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          @input=${this.dispatchInputChangeEvent.bind(this)}
          @keydown=${this.onKeyDown}
          .value=${this.value||""}
        />
        ${this.templateSubmitButton()}
        <slot class="wui-input-text-slot"></slot>
      </div>
      ${this.templateError()} ${this.templateWarning()}`}templateLeftIcon(){return this.icon?u`<wui-icon
        class="wui-input-text-left-icon"
        size="md"
        data-size=${this.size}
        color="inherit"
        name=${this.icon}
      ></wui-icon>`:null}templateSubmitButton(){var e;return this.onSubmit?u`<button
        class="wui-input-text-submit-button ${this.loading?"loading":""}"
        @click=${(e=this.onSubmit)==null?void 0:e.bind(this)}
        ?disabled=${this.disabled||this.loading}
      >
        ${this.loading?u`<wui-icon name="spinner" size="md"></wui-icon>`:u`<wui-icon name="chevronRight" size="md"></wui-icon>`}
      </button>`:null}templateError(){return this.errorText?u`<wui-text variant="sm-regular" color="error">${this.errorText}</wui-text>`:null}templateWarning(){return this.warningText?u`<wui-text variant="sm-regular" color="warning">${this.warningText}</wui-text>`:null}dispatchInputChangeEvent(){var e;this.dispatchEvent(new CustomEvent("inputChange",{detail:(e=this.inputElementRef.value)==null?void 0:e.value,bubbles:!0,composed:!0}))}};F.styles=[Y,ye,Zi];G([p()],F.prototype,"icon",void 0);G([p({type:Boolean})],F.prototype,"disabled",void 0);G([p({type:Boolean})],F.prototype,"loading",void 0);G([p()],F.prototype,"placeholder",void 0);G([p()],F.prototype,"type",void 0);G([p()],F.prototype,"value",void 0);G([p()],F.prototype,"errorText",void 0);G([p()],F.prototype,"warningText",void 0);G([p()],F.prototype,"onSubmit",void 0);G([p()],F.prototype,"size",void 0);G([p({attribute:!1})],F.prototype,"onKeyDown",void 0);F=G([N("wui-input-text")],F);const er=U`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  wui-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:t})=>t[3]};
    color: ${({tokens:t})=>t.theme.iconDefault};
    cursor: pointer;
    padding: ${({spacing:t})=>t[2]};
    background-color: transparent;
    border-radius: ${({borderRadius:t})=>t[4]};
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
  }

  @media (hover: hover) {
    wui-icon:hover {
      background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    }
  }
`;var Un=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Qe=class extends O{constructor(){super(...arguments),this.inputComponentRef=Nt(),this.inputValue=""}render(){return u`
      <wui-input-text
        ${Mt(this.inputComponentRef)}
        placeholder="Search wallet"
        icon="search"
        type="search"
        enterKeyHint="search"
        size="sm"
        @inputChange=${this.onInputChange}
      >
        ${this.inputValue?u`<wui-icon
              @click=${this.clearValue}
              color="inherit"
              size="sm"
              name="close"
            ></wui-icon>`:null}
      </wui-input-text>
    `}onInputChange(e){this.inputValue=e.detail||""}clearValue(){const e=this.inputComponentRef.value,i=e==null?void 0:e.inputElementRef.value;i&&(i.value="",this.inputValue="",i.focus(),i.dispatchEvent(new Event("input")))}};Qe.styles=[Y,er];Un([p()],Qe.prototype,"inputValue",void 0);Qe=Un([N("wui-search-bar")],Qe);const tr=U`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 104px;
    width: 104px;
    row-gap: ${({spacing:t})=>t[2]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[5]};
    position: relative;
  }

  wui-shimmer[data-type='network'] {
    border: none;
    -webkit-clip-path: var(--apkt-path-network);
    clip-path: var(--apkt-path-network);
  }

  svg {
    position: absolute;
    width: 48px;
    height: 54px;
    z-index: 1;
  }

  svg > path {
    stroke: ${({tokens:t})=>t.theme.foregroundSecondary};
    stroke-width: 1px;
  }

  @media (max-width: 350px) {
    :host {
      width: 100%;
    }
  }
`;var qn=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Je=class extends O{constructor(){super(...arguments),this.type="wallet"}render(){return u`
      ${this.shimmerTemplate()}
      <wui-shimmer width="80px" height="20px"></wui-shimmer>
    `}shimmerTemplate(){return this.type==="network"?u` <wui-shimmer data-type=${this.type} width="48px" height="54px"></wui-shimmer>
        ${ti}`:u`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}};Je.styles=[Y,ye,tr];qn([p()],Je.prototype,"type",void 0);Je=qn([N("wui-card-select-loader")],Je);const nr=An`
  :host {
    display: grid;
    width: inherit;
    height: inherit;
  }
`;var Q=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let V=class extends O{render(){return this.style.cssText=`
      grid-template-rows: ${this.gridTemplateRows};
      grid-template-columns: ${this.gridTemplateColumns};
      justify-items: ${this.justifyItems};
      align-items: ${this.alignItems};
      justify-content: ${this.justifyContent};
      align-content: ${this.alignContent};
      column-gap: ${this.columnGap&&`var(--apkt-spacing-${this.columnGap})`};
      row-gap: ${this.rowGap&&`var(--apkt-spacing-${this.rowGap})`};
      gap: ${this.gap&&`var(--apkt-spacing-${this.gap})`};
      padding-top: ${this.padding&&se.getSpacingStyles(this.padding,0)};
      padding-right: ${this.padding&&se.getSpacingStyles(this.padding,1)};
      padding-bottom: ${this.padding&&se.getSpacingStyles(this.padding,2)};
      padding-left: ${this.padding&&se.getSpacingStyles(this.padding,3)};
      margin-top: ${this.margin&&se.getSpacingStyles(this.margin,0)};
      margin-right: ${this.margin&&se.getSpacingStyles(this.margin,1)};
      margin-bottom: ${this.margin&&se.getSpacingStyles(this.margin,2)};
      margin-left: ${this.margin&&se.getSpacingStyles(this.margin,3)};
    `,u`<slot></slot>`}};V.styles=[Y,nr];Q([p()],V.prototype,"gridTemplateRows",void 0);Q([p()],V.prototype,"gridTemplateColumns",void 0);Q([p()],V.prototype,"justifyItems",void 0);Q([p()],V.prototype,"alignItems",void 0);Q([p()],V.prototype,"justifyContent",void 0);Q([p()],V.prototype,"alignContent",void 0);Q([p()],V.prototype,"columnGap",void 0);Q([p()],V.prototype,"rowGap",void 0);Q([p()],V.prototype,"gap",void 0);Q([p()],V.prototype,"padding",void 0);Q([p()],V.prototype,"margin",void 0);V=Q([N("wui-grid")],V);const ir=U`
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    width: 104px;
    row-gap: ${({spacing:t})=>t[2]};
    padding: ${({spacing:t})=>t[3]} ${({spacing:t})=>t[0]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: clamp(0px, ${({borderRadius:t})=>t[4]}, 20px);
    transition:
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-1"]},
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-1"]},
      border-radius ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-1"]};
    will-change: background-color, color, border-radius;
    outline: none;
    border: none;
  }

  button > wui-flex > wui-text {
    color: ${({tokens:t})=>t.theme.textPrimary};
    max-width: 86px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }

  button > wui-flex > wui-text.certified {
    max-width: 66px;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    }
  }

  button:disabled > wui-flex > wui-text {
    color: ${({tokens:t})=>t.core.glass010};
  }

  [data-selected='true'] {
    background-color: ${({colors:t})=>t.accent020};
  }

  @media (hover: hover) and (pointer: fine) {
    [data-selected='true']:hover:enabled {
      background-color: ${({colors:t})=>t.accent010};
    }
  }

  [data-selected='true']:active:enabled {
    background-color: ${({colors:t})=>t.accent010};
  }

  @media (max-width: 350px) {
    button {
      width: 100%;
    }
  }
`;var ne=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let K=class extends O{constructor(){super(),this.observer=new IntersectionObserver(()=>{}),this.visible=!1,this.imageSrc=void 0,this.imageLoading=!1,this.isImpressed=!1,this.explorerId="",this.walletQuery="",this.certified=!1,this.displayIndex=0,this.wallet=void 0,this.observer=new IntersectionObserver(e=>{e.forEach(i=>{i.isIntersecting?(this.visible=!0,this.fetchImageSrc(),this.sendImpressionEvent()):this.visible=!1})},{threshold:.01})}firstUpdated(){this.observer.observe(this)}disconnectedCallback(){this.observer.disconnect()}render(){var i,r;const e=((i=this.wallet)==null?void 0:i.badge_type)==="certified";return u`
      <button>
        ${this.imageTemplate()}
        <wui-flex flexDirection="row" alignItems="center" justifyContent="center" gap="1">
          <wui-text
            variant="md-regular"
            color="inherit"
            class=${D(e?"certified":void 0)}
            >${(r=this.wallet)==null?void 0:r.name}</wui-text
          >
          ${e?u`<wui-icon size="sm" name="walletConnectBrown"></wui-icon>`:null}
        </wui-flex>
      </button>
    `}imageTemplate(){var e,i;return!this.visible&&!this.imageSrc||this.imageLoading?this.shimmerTemplate():u`
      <wui-wallet-image
        size="lg"
        imageSrc=${D(this.imageSrc)}
        name=${D((e=this.wallet)==null?void 0:e.name)}
        .installed=${((i=this.wallet)==null?void 0:i.installed)??!1}
        badgeSize="sm"
      >
      </wui-wallet-image>
    `}shimmerTemplate(){return u`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}async fetchImageSrc(){this.wallet&&(this.imageSrc=ue.getWalletImage(this.wallet),!this.imageSrc&&(this.imageLoading=!0,this.imageSrc=await ue.fetchWalletImage(this.wallet.image_id),this.imageLoading=!1))}sendImpressionEvent(){!this.wallet||this.isImpressed||(this.isImpressed=!0,H.sendWalletImpressionEvent({name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.explorerId,view:B.state.view,query:this.walletQuery,certified:this.certified,displayIndex:this.displayIndex}))}};K.styles=ir;ne([P()],K.prototype,"visible",void 0);ne([P()],K.prototype,"imageSrc",void 0);ne([P()],K.prototype,"imageLoading",void 0);ne([P()],K.prototype,"isImpressed",void 0);ne([p()],K.prototype,"explorerId",void 0);ne([p()],K.prototype,"walletQuery",void 0);ne([p()],K.prototype,"certified",void 0);ne([p()],K.prototype,"displayIndex",void 0);ne([p({type:Object})],K.prototype,"wallet",void 0);K=ne([N("w3m-all-wallets-list-item")],K);const rr=U`
  wui-grid {
    max-height: clamp(360px, 400px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  w3m-all-wallets-list-item {
    opacity: 0;
    animation-duration: ${({durations:t})=>t.xl};
    animation-timing-function: ${({easings:t})=>t["ease-inout-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  wui-loading-spinner {
    padding-top: ${({spacing:t})=>t[4]};
    padding-bottom: ${({spacing:t})=>t[4]};
    justify-content: center;
    grid-column: 1 / span 4;
  }
`;var Ne=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};const En="local-paginator";let me=class extends O{constructor(){super(),this.unsubscribe=[],this.paginationObserver=void 0,this.loading=!j.state.wallets.length,this.wallets=j.state.wallets,this.mobileFullScreen=z.state.enableMobileFullScreen,this.unsubscribe.push(j.subscribeKey("wallets",e=>this.wallets=e))}firstUpdated(){this.initialFetch(),this.createPaginationObserver()}disconnectedCallback(){var e;this.unsubscribe.forEach(i=>i()),(e=this.paginationObserver)==null||e.disconnect()}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),u`
      <wui-grid
        data-scroll=${!this.loading}
        .padding=${["0","3","3","3"]}
        gap="2"
        justifyContent="space-between"
      >
        ${this.loading?this.shimmerTemplate(16):this.walletsTemplate()}
        ${this.paginationLoaderTemplate()}
      </wui-grid>
    `}async initialFetch(){var i;this.loading=!0;const e=(i=this.shadowRoot)==null?void 0:i.querySelector("wui-grid");e&&(await j.fetchWalletsByPage({page:1}),await e.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.loading=!1,e.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}shimmerTemplate(e,i){return[...Array(e)].map(()=>u`
        <wui-card-select-loader type="wallet" id=${D(i)}></wui-card-select-loader>
      `)}walletsTemplate(){return Pt.getWalletConnectWallets(this.wallets).map((e,i)=>u`
        <w3m-all-wallets-list-item
          data-testid="wallet-search-item-${e.id}"
          @click=${()=>this.onConnectWallet(e)}
          .wallet=${e}
          explorerId=${e.id}
          certified=${this.badge==="certified"}
          displayIndex=${i}
        ></w3m-all-wallets-list-item>
      `)}paginationLoaderTemplate(){const{wallets:e,recommended:i,featured:r,count:o,mobileFilteredOutWalletsLength:n}=j.state,s=window.innerWidth<352?3:4,a=e.length+i.length;let c=Math.ceil(a/s)*s-a+s;return c-=e.length?r.length%s:0,o===0&&r.length>0?null:o===0||[...r,...e,...i].length<o-(n??0)?this.shimmerTemplate(c,En):null}createPaginationObserver(){var i;const e=(i=this.shadowRoot)==null?void 0:i.querySelector(`#${En}`);e&&(this.paginationObserver=new IntersectionObserver(([r])=>{if(r!=null&&r.isIntersecting&&!this.loading){const{page:o,count:n,wallets:s}=j.state;s.length<n&&j.fetchWalletsByPage({page:o+1})}}),this.paginationObserver.observe(e))}onConnectWallet(e){J.selectWalletConnector(e)}};me.styles=rr;Ne([P()],me.prototype,"loading",void 0);Ne([P()],me.prototype,"wallets",void 0);Ne([P()],me.prototype,"badge",void 0);Ne([P()],me.prototype,"mobileFullScreen",void 0);me=Ne([N("w3m-all-wallets-list")],me);const or=An`
  wui-grid,
  wui-loading-spinner,
  wui-flex {
    height: 360px;
  }

  wui-grid {
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
    height: auto;
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-loading-spinner {
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;var Me=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let be=class extends O{constructor(){super(...arguments),this.prevQuery="",this.prevBadge=void 0,this.loading=!0,this.mobileFullScreen=z.state.enableMobileFullScreen,this.query=""}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),this.onSearch(),this.loading?u`<wui-loading-spinner color="accent-primary"></wui-loading-spinner>`:this.walletsTemplate()}async onSearch(){(this.query.trim()!==this.prevQuery.trim()||this.badge!==this.prevBadge)&&(this.prevQuery=this.query,this.prevBadge=this.badge,this.loading=!0,await j.searchWallet({search:this.query,badge:this.badge}),this.loading=!1)}walletsTemplate(){const{search:e}=j.state,i=Pt.markWalletsAsInstalled(e),r=Pt.filterWalletsByWcSupport(i);return r.length?u`
      <wui-grid
        data-testid="wallet-list"
        .padding=${["0","3","3","3"]}
        rowGap="4"
        columngap="2"
        justifyContent="space-between"
      >
        ${r.map((o,n)=>u`
            <w3m-all-wallets-list-item
              @click=${()=>this.onConnectWallet(o)}
              .wallet=${o}
              data-testid="wallet-search-item-${o.id}"
              explorerId=${o.id}
              certified=${this.badge==="certified"}
              walletQuery=${this.query}
              displayIndex=${n}
            ></w3m-all-wallets-list-item>
          `)}
      </wui-grid>
    `:u`
        <wui-flex
          data-testid="no-wallet-found"
          justifyContent="center"
          alignItems="center"
          gap="3"
          flexDirection="column"
        >
          <wui-icon-box size="lg" color="default" icon="wallet"></wui-icon-box>
          <wui-text data-testid="no-wallet-found-text" color="secondary" variant="md-medium">
            No Wallet found
          </wui-text>
        </wui-flex>
      `}onConnectWallet(e){J.selectWalletConnector(e)}};be.styles=or;Me([P()],be.prototype,"loading",void 0);Me([P()],be.prototype,"mobileFullScreen",void 0);Me([p()],be.prototype,"query",void 0);Me([p()],be.prototype,"badge",void 0);be=Me([N("w3m-all-wallets-search")],be);var Ot=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Ye=class extends O{constructor(){super(...arguments),this.search="",this.badge=void 0,this.onDebouncedSearch=M.debounce(e=>{this.search=e})}render(){const e=this.search.length>=2;return u`
      <wui-flex .padding=${["1","3","3","3"]} gap="2" alignItems="center">
        <wui-search-bar @inputChange=${this.onInputChange.bind(this)}></wui-search-bar>
        <wui-certified-switch
          ?checked=${this.badge==="certified"}
          @certifiedSwitchChange=${this.onCertifiedSwitchChange.bind(this)}
          data-testid="wui-certified-switch"
        ></wui-certified-switch>
        ${this.qrButtonTemplate()}
      </wui-flex>
      ${e||this.badge?u`<w3m-all-wallets-search
            query=${this.search}
            .badge=${this.badge}
          ></w3m-all-wallets-search>`:u`<w3m-all-wallets-list .badge=${this.badge}></w3m-all-wallets-list>`}
    `}onInputChange(e){this.onDebouncedSearch(e.detail)}onCertifiedSwitchChange(e){e.detail?(this.badge="certified",Be.showSvg("Only WalletConnect certified",{icon:"walletConnectBrown",iconColor:"accent-100"})):this.badge=void 0}qrButtonTemplate(){return M.isMobile()?u`
        <wui-icon-box
          size="xl"
          iconSize="xl"
          color="accent-primary"
          icon="qrCode"
          border
          borderColor="wui-accent-glass-010"
          @click=${this.onWalletConnectQr.bind(this)}
        ></wui-icon-box>
      `:null}onWalletConnectQr(){B.push("ConnectingWalletConnect")}};Ot([P()],Ye.prototype,"search",void 0);Ot([P()],Ye.prototype,"badge",void 0);Ye=Ot([N("w3m-all-wallets-view")],Ye);var sr=function(t,e,i,r){var o=arguments.length,n=o<3?e:r===null?r=Object.getOwnPropertyDescriptor(e,i):r,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n};let Rn=class extends O{constructor(){var e;super(...arguments),this.wallet=(e=B.state.data)==null?void 0:e.wallet}render(){if(!this.wallet)throw new Error("w3m-downloads-view");return u`
      <wui-flex gap="2" flexDirection="column" .padding=${["3","3","4","3"]}>
        ${this.chromeTemplate()} ${this.iosTemplate()} ${this.androidTemplate()}
        ${this.homepageTemplate()}
      </wui-flex>
    `}chromeTemplate(){var e;return(e=this.wallet)!=null&&e.chrome_store?u`<wui-list-item
      variant="icon"
      icon="chromeStore"
      iconVariant="square"
      @click=${this.onChromeStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Chrome Extension</wui-text>
    </wui-list-item>`:null}iosTemplate(){var e;return(e=this.wallet)!=null&&e.app_store?u`<wui-list-item
      variant="icon"
      icon="appStore"
      iconVariant="square"
      @click=${this.onAppStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">iOS App</wui-text>
    </wui-list-item>`:null}androidTemplate(){var e;return(e=this.wallet)!=null&&e.play_store?u`<wui-list-item
      variant="icon"
      icon="playStore"
      iconVariant="square"
      @click=${this.onPlayStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Android App</wui-text>
    </wui-list-item>`:null}homepageTemplate(){var e;return(e=this.wallet)!=null&&e.homepage?u`
      <wui-list-item
        variant="icon"
        icon="browser"
        iconVariant="square-blue"
        @click=${this.onHomePage.bind(this)}
        chevron
      >
        <wui-text variant="md-medium" color="primary">Website</wui-text>
      </wui-list-item>
    `:null}openStore(e){e.href&&this.wallet&&(H.sendEvent({type:"track",event:"GET_WALLET",properties:{name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.wallet.id,type:e.type}}),M.openHref(e.href,"_blank"))}onChromeStore(){var e;(e=this.wallet)!=null&&e.chrome_store&&this.openStore({href:this.wallet.chrome_store,type:"chrome_store"})}onAppStore(){var e;(e=this.wallet)!=null&&e.app_store&&this.openStore({href:this.wallet.app_store,type:"app_store"})}onPlayStore(){var e;(e=this.wallet)!=null&&e.play_store&&this.openStore({href:this.wallet.play_store,type:"play_store"})}onHomePage(){var e;(e=this.wallet)!=null&&e.homepage&&this.openStore({href:this.wallet.homepage,type:"homepage"})}};Rn=sr([N("w3m-downloads-view")],Rn);export{Ye as W3mAllWalletsView,He as W3mConnectingWcBasicView,Rn as W3mDownloadsView};
