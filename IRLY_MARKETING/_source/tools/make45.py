"""Builds the Instagram feed (4:5, 1080 x 1350) versions of the image compositions.
Each 9:16 composition is copied with its elements repositioned for the shorter frame.
python3 make45.py   (run from IRLY_MARKETING/_source)"""
import os

R = {
 'girl_01_discover': [('left:74px; top:176px', 'left:74px; top:80px'), ('top:320px; width:940px', 'top:190px; width:940px'),
   ('top:600px; width:800px', 'top:450px; width:800px'), ('left:250px; top:790px; width:580px', 'left:290px; top:600px; width:500px')],
 'girl_02_activities': [('top:180px; width:940px', 'top:80px; width:940px'),
   ('left:70px; top:520px; width:440px; height:600px', 'left:70px; top:370px; width:440px; height:470px'),
   ('left:540px; top:440px; width:470px; height:470px', 'left:540px; top:370px; width:470px; height:320px'),
   ('left:540px; top:940px; width:470px; height:420px', 'left:540px; top:710px; width:470px; height:300px'),
   ('left:70px; top:1180px; width:760px', 'left:70px; top:870px; width:720px'),
   ('top:1540px; width:900px', 'top:1205px; width:640px'), ('left:74px; top:1690px', 'left:770px; top:1225px')],
 'girl_03_trip': [('left:74px; top:176px', 'left:74px; top:80px'), ('top:930px; width:940px', 'top:760px; width:940px'),
   ('left:70px; top:1150px; width:760px', 'left:70px; top:960px; width:760px')],
 'girl_04_expat': [('width:1080px; height:1100px', 'width:1080px; height:800px'), ('top:640px; width:1080px; height:470px', 'top:440px; width:1080px; height:370px'),
   ('left:74px; top:176px', 'left:74px; top:80px'), ('top:960px; width:960px', 'top:700px; width:960px'),
   ('left:70px; top:1240px; width:760px', 'left:70px; top:975px; width:700px'), ('top:1600px; width:900px', 'top:1600px; display:none; width:900px')],
 'girl_05_network': [('left:74px; top:180px', 'left:74px; top:80px'), ('top:240px; width:960px', 'top:140px; width:960px'),
   ('left:70px; top:700px; width:470px', 'left:70px; top:440px; width:420px'), ('left:560px; top:820px; width:450px', 'left:600px; top:540px; width:400px')],
 'mixte_01_discover': [('left:72px; top:170px', 'left:72px; top:70px'), ('left:74px; top:300px', 'left:74px; top:190px'),
   ('top:360px; width:900px', 'top:245px; width:900px'), ('top:478px; width:820px', 'top:365px; width:820px'),
   ('left:240px; top:690px; width:600px', 'left:290px; top:520px; width:500px')],
 'mixte_02_activities': [('width:1080px; height:860px; display:grid', 'width:1080px; height:560px; display:grid'),
   ('padelMix.jpg" alt="" style="width:100%; height:860px', 'padelMix.jpg" alt="" style="width:100%; height:560px'),
   ('footballMix.jpg" alt="" style="width:100%; height:860px', 'footballMix.jpg" alt="" style="width:100%; height:560px'),
   ('runMix.jpg" alt="" style="width:100%; height:860px', 'runMix.jpg" alt="" style="width:100%; height:560px'),
   ('top:380px; width:1080px; height:480px', 'top:240px; width:1080px; height:320px'), ('left:72px; top:180px; padding', 'left:72px; top:80px; padding'),
   ('top:730px; width:940px', 'top:460px; width:940px'), ('left:520px; top:1050px; width:500px', 'left:620px; top:720px; width:400px'),
   ('left:60px; top:1180px; width:640px', 'left:60px; top:780px; width:600px'), ('top:1520px; width:400px', 'top:1085px; width:480px'),
   ('left:72px; top:1700px', 'left:72px; top:1265px')],
 'mixte_03_communities': [('left:72px; top:180px', 'left:72px; top:80px'), ('top:240px; width:940px', 'top:140px; width:940px'),
   ('top:470px; width:760px', 'top:360px; width:760px'), ('left:72px; top:700px; width:940px', 'left:72px; top:520px; width:940px'),
   ('gap:26px', 'gap:18px'), ('left:72px; top:1460px', 'left:72px; top:1200px')],
 'mixte_04_irl': [('left:72px; top:180px', 'left:72px; top:80px'), ('left:90px; top:880px; width:900px', 'left:90px; top:600px; width:900px'),
   ('top:1120px; width:940px', 'top:820px; width:940px'), ('top:1350px; width:880px', 'top:1040px; width:880px'), ('left:74px; top:1560px', 'left:74px; top:1215px')],
 'mixte_05_network': [('left:72px; top:180px', 'left:72px; top:80px'), ('top:240px; width:900px', 'top:140px; width:900px'),
   ('left:70px; top:620px; width:470px', 'left:70px; top:400px; width:430px'), ('left:560px; top:760px; width:450px', 'left:590px; top:520px; width:410px'),
   ('left:72px; top:1720px', 'left:72px; top:1720px; display:none')],
 'network_01_discover': [('top:176px; display:flex', 'top:70px; display:flex'), ('top:310px; text-align:center', 'top:170px; text-align:center'),
   ('left:440px; top:460px', 'left:440px; top:315px'), ('top:510px; text-align:center', 'top:350px; text-align:center'),
   ('left:200px; top:760px; width:680px', 'left:260px; top:540px; width:560px')],
 'network_02_grow': [('left:72px; top:180px', 'left:72px; top:80px'), ('top:240px; width:940px', 'top:140px; width:940px'),
   ('top:580px; width:880px', 'top:360px; width:880px'), ('left:70px; top:780px; width:940px', 'left:140px; top:520px; width:800px'),
   ('left:72px; top:1740px', 'left:72px; top:1740px; display:none')],
 'network_03_founders': [('width:1080px; height:1150px; object-fit', 'width:1080px; height:800px; object-fit'),
   ('top:0; width:1080px; height:1150px', 'top:0; width:1080px; height:800px'), ('top:180px; width:940px', 'top:80px; width:940px'),
   ('left:40px; top:1060px; width:1040px', 'left:40px; top:720px; width:1040px'), ('top:1340px; width:880px', 'top:1000px; width:880px'),
   ('left:72px; top:1640px', 'left:72px; top:1240px')],
 'network_04_communities': [('left:72px; top:180px', 'left:72px; top:80px'), ('top:240px; width:900px', 'top:140px; width:900px'),
   ('left:250px; top:620px; width:640px', 'left:300px; top:400px; width:540px'), ('top:1430px; width:900px', 'top:1100px; width:900px'),
   ('left:72px; top:1640px', 'left:72px; top:1250px')],
 'network_05_girl_network': [('width:1080px; height:1000px; object-fit', 'width:1080px; height:700px; object-fit'),
   ('top:560px; width:1080px; height:440px', 'top:380px; width:1080px; height:320px'), ('left:74px; top:180px', 'left:74px; top:80px'),
   ('top:860px; width:960px', 'top:600px; width:960px'), ('left:70px; top:1180px; width:940px', 'left:140px; top:880px; width:800px'),
   ('left:74px; top:1640px', 'left:74px; top:1262px')],
 'slide_01': [('top:190px; width:860px', 'top:90px; width:860px')],
 'slide_02': [('top:190px; width:860px', 'top:90px; width:860px'), ('left:74px; top:390px', 'left:74px; top:290px')],
 'slide_03': [('left:40px; top:170px; width:1000px; height:1000px; object-fit', 'left:40px; top:70px; width:1000px; height:860px; object-fit'),
   ('left:40px; top:170px; width:1000px; height:1000px; border-radius:56px;', 'left:40px; top:70px; width:1000px; height:860px; border-radius:56px;'),
   ('top:1220px; width:860px', 'top:970px; width:860px')],
 'slide_04': [('top:180px; width:860px', 'top:80px; width:860px'), ('left:80px; top:560px; width:420px', 'left:80px; top:360px; width:380px'),
   ('left:420px; top:500px; width:460px', 'left:440px; top:300px; width:420px')],
 'slide_05': [('top:420px; display:flex', 'top:260px; display:flex'), ('top:820px; text-align:center', 'top:640px; text-align:center'),
   ('top:1010px; margin:0', 'top:830px; margin:0'), ('top:1160px; display:flex', 'top:960px; display:flex')],
}

for name, reps in R.items():
    s = open(f'images/{name}.html').read()
    for old, new in reps:
        n = s.count(old)
        assert n == 1, f'{name}: "{old}" found {n} times'
        s = s.replace(old, new)
    s = s.replace('href="common.css">', 'href="../images/common.css"><link rel="stylesheet" href="insta.css">')
    s = s.replace('src="common.js"', 'src="../images/common.js"')
    s = s.replace('<title>', '<title>Insta 4:5 · ')
    open(f'images45/{name}.html', 'w').write(s)
    print('ok', name)
