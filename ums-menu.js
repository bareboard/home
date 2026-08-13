/* UMS LIVE contextual left navigation. The current section is never offered as a redundant destination. */
(() => {
  const button=document.querySelector('#_yb_sidenav-btn');
  const header=document.querySelector('header.hideOnPrint.yf-w91b48');
  if(!button||!header)return;
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const isMarket=['market.html','markets.html'].includes(page);
  const isHome=['index.html','home.html',''].includes(page);
  const isAbout=page==='about.html';
  button.setAttribute('aria-label','Open UMS LIVE menu');button.setAttribute('aria-expanded','false');
  const menu=document.createElement('nav');menu.className='ums-market-menu';menu.setAttribute('aria-label','UMS LIVE menu');
  const link=(href,label,current)=>`<a href="${href}"${current?' aria-current="page"':''}>${label}</a>`;
  menu.innerHTML='<div class="ums-menu-brand"><img src="assets/bareboard-logo.svg" alt="UMS LIVE"></div>'+[
    !isHome?link('home.html','Home'):'',
    !isMarket?link('markets.html','Market'):'',
    `<div class="ums-menu-group${isAbout?' is-expanded':''}"><button type="button" class="ums-menu-group-toggle" aria-expanded="${isAbout}">About</button><div class="ums-menu-submenu"><div>${link('about.html','About UMS LIVE',isAbout)}${link('founder.html','The Founder',page==='founder.html')}${link('holding-company.html','The Holding Company',page==='holding-company.html')}</div></div></div>`
  ].join('');
  const backdrop=document.createElement('div');backdrop.className='ums-menu-backdrop';
  document.body.append(backdrop,menu);
  const close=()=>{menu.classList.remove('is-open');backdrop.classList.remove('is-open');button.setAttribute('aria-expanded','false');};
  button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const open=!menu.classList.contains('is-open');menu.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));},true);
  menu.querySelector('.ums-menu-group-toggle')?.addEventListener('click',event=>{const group=event.currentTarget.closest('.ums-menu-group');const open=!group.classList.contains('is-expanded');group.classList.toggle('is-expanded',open);event.currentTarget.setAttribute('aria-expanded',String(open));});
  backdrop.addEventListener('click',close);document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
})();
