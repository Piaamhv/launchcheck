import asyncio, subprocess, json, os
from playwright.async_api import async_playwright
B='video/build'
SC=[
("title","LaunchCheck checks launch copy against your current product docs before it ships. Release notes, pricing pages and sales emails often quote last quarter's price, or a feature that is still only planned."),
("input","Here is a real example with synthetic data: a short launch blurb, and three sources. The October pricing page, the older March pricing page, and the release notes for version 4.2."),
("compare","I click check. First, Clocked Compare reads every pair of sources. It finds that the March and October pricing pages conflict, fifteen versus twelve dollars, so the older page is retired as stale and excluded from evidence."),
("red1","Next, for every claim, Clocked Rerank picks the passages that actually answer it, and Verify checks the claim only against those passages. The twelve dollar price is contradicted, and a second Verify pass shows it is supported only by the retired March page. So the copy is out of date, not invented."),
("red2","Every plan includes SSO is contradicted: only Business and Enterprise. Under two seconds is contradicted by the measured median of 2.4 seconds. And iOS and Android offline mode is contradicted, because Android is only planned. Each finding shows the quoted source span."),
("fixed","Now I load the corrected copy and run it again. Every claim is green and grounded in a current source, with Verify's confidence next to it."),
("arch","How it differs from Margin, the academic review entry: Margin compares student submissions against each other. LaunchCheck uses Compare to decide which sources are current, then uses Rerank output to choose exactly what Verify sees, and re-checks failures against stale docs. Those outputs drive every color in the report."),
("end","It runs with one command, replays recorded live responses when there is no API key, and degrades gracefully when a call fails. LaunchCheck. Ship the copy, not the mistakes."),
]
CARD='''<html><body style="margin:0;width:1280px;height:720px;background:#111;color:#fff;font:28px system-ui;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">%s</body></html>'''
TITLE=CARD%'<h1 style="font-size:64px;margin:0">LaunchCheck</h1><p>Check launch copy against your <b>current</b> docs before it ships.</p><p style="color:#aaa">Clocked Build Challenge 2026 · Compare → Rerank → Verify</p>'
ARCH=CARD%'<h2>Pipeline</h2><p>1. <b>Compare</b>: conflicting doc versions → older one retired as stale</p><p>2. <b>Rerank</b>: per claim, keep passages marked use / expand</p><p>3. <b>Verify</b>: ground each claim only in kept passages → red / amber / green</p><p>4. <b>Verify</b> again on stale docs → "out of date" flag</p><p style="color:#aaa">vs Margin: sources judged for freshness, not submissions compared to each other</p>'
END=CARD%'<h1 style="font-size:56px;margin:0">LaunchCheck</h1><p>npm start · no install · replay mode without a key</p><p style="color:#aaa">Ship the copy, not the mistakes.</p>'
CAP='''(t)=>{let d=document.getElementById('cap');if(!d){d=document.createElement('div');d.id='cap';document.body.appendChild(d)}
d.style.cssText='position:fixed;left:0;right:0;bottom:0;background:rgba(0,0,0,.82);color:#fff;font:19px system-ui;padding:10px 40px;text-align:center;z-index:9';d.textContent=t}'''
async def tts(i,t):
    a=f'{B}/{i}.mp3'; subprocess.run(['edge-tts','--voice','en-US-AndrewNeural','--text',t,'--write-media',a],check=True,capture_output=True)
    return float(subprocess.check_output(['ffprobe','-v','0','-show_entries','format=duration','-of','csv=p=0',a]))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1280,'height':720})
        shots=[]
        async def shot(i,text,scroll=None):
            await pg.evaluate(CAP,text)
            if scroll: await pg.evaluate(f"document.querySelector('{scroll}')?.scrollIntoView({{block:'start'}})")
            f=f'{B}/{i}.png'; await pg.screenshot(path=f); shots.append(f)
        for i,(k,t) in enumerate(SC):
            if k=='title': await pg.set_content(TITLE)
            if k=='input': await pg.goto('http://localhost:3123/'); await pg.wait_for_timeout(800)
            if k=='compare':
                await pg.click('#go'); await pg.wait_for_selector('.c',timeout=90000); await pg.evaluate("document.getElementById('docs').rows=3;document.getElementById('out').scrollIntoView()")
            if k=='red1': await pg.evaluate("document.querySelectorAll('.c')[0].scrollIntoView({block:'center'})")
            if k=='red2': await pg.evaluate("document.querySelectorAll('.c')[4].scrollIntoView({block:'end'})")
            if k=='fixed':
                await pg.evaluate("scrollTo(0,0)"); await pg.click('#fix'); await pg.evaluate("document.getElementById('out').innerHTML=''")
                await pg.click('#go'); await pg.wait_for_selector('.c',timeout=90000); await pg.evaluate("document.getElementById('docs').rows=3;document.getElementById('out').scrollIntoView()")
            if k=='arch': await pg.set_content(ARCH)
            if k=='end': await pg.set_content(END)
            await shot(i,t)
        await b.close()
    segs=[]
    for i,(k,t) in enumerate(SC):
        d=await tts(i,t)+0.6; s=f'{B}/seg{i}.mp4'
        subprocess.run(['ffmpeg','-y','-v','error','-loop','1','-i',shots[i],'-i',f'{B}/{i}.mp3','-af','apad','-t',str(d),'-c:v','libx264','-tune','stillimage','-pix_fmt','yuv420p','-r','30','-c:a','aac','-ar','44100',s],check=True); segs.append(s)
    open(f'{B}/list.txt','w').write(''.join(f"file '{os.path.basename(s)}'\n" for s in segs))
    subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',f'{B}/list.txt','-c','copy','video/final.mp4'],check=True)
asyncio.run(main())
