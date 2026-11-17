from playwright.sync_api import sync_playwright
import json
PROF="/home/rune/.local/share/lopegutten-bot/chrome"
EXE="/usr/bin/chromium"
def veil_open(pg): return pg.evaluate("()=>!document.querySelector('#veil').hidden")
def closeall(pg):
    for _ in range(6):
        if not veil_open(pg): return
        pg.evaluate("()=>{const x=document.querySelector('#slip .slipx');if(x){x.click();return}const b=[...document.querySelectorAll('#slip footer button')];b.length&&b[b.length-1].click()}")
        pg.wait_for_timeout(900)
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(PROF, headless=True, executable_path=EXE, viewport={"width":1280,"height":900})
    pg=ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.goto("https://lopegutten.com/", timeout=60000, wait_until="load"); pg.wait_for_timeout(3500); closeall(pg)
    out=pg.evaluate("""(function(){
      const kf=(JSON.parse(localStorage.getItem('gudfaren.kasFam')||'{}'))||{};
      let si=null;try{si=(JSON.parse(localStorage.getItem('gudfaren.saveI')||'{"v":0}')||{}).S||null}catch(_){}
      let sv=null;try{sv=(JSON.parse(localStorage.getItem('gudfaren.save')||'{"v":0}')||{}).S||null}catch(_){}
      const s2=x=>x?{day:x.day,money:x.money,over:x.over,dyn:x.dyn}:null;
      return {kasFam:kf,saveI:s2(si),save:s2(sv)}})()""")
    print(json.dumps(out,ensure_ascii=False,indent=1))
    ctx.close()
