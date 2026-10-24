// SECTION: sample stylesheets a new project starts with
const SAMPLES={
'riso-zine.css':`/* riso-zine.css — sample stylesheet */
:root{--ink:#2b2bd9;--pink:#ff4fa3;--sun:#ffd23f;--paper:#fff6e0}
body{font-family:"Rubik Mono One","Arial Black",sans-serif;color:var(--ink)}
h1{font-size:46px;line-height:.95;margin:0;text-transform:uppercase;color:var(--pink);text-shadow:3px 3px 0 var(--shadow)}
h1.outline{color:var(--sun);-webkit-text-stroke:2px var(--ink);text-shadow:5px 5px 0 var(--pink)}
h1.stacked{background:var(--ink);color:var(--paper);padding:8px 14px;display:inline-block;text-shadow:none}
h2{font-size:26px;margin:0;background:var(--pink);color:#fff;display:inline-block;padding:2px 12px;transform:rotate(-2deg)}
h2.underline{background:none;color:var(--ink);border-bottom:6px solid var(--sun);transform:none}
h3{font-size:18px;margin:0;letter-spacing:2px;text-transform:uppercase}
p{font-family:Fraunces,Georgia,serif;font-size:16px;line-height:1.5;margin:0}
p.lead{font-size:21px;font-style:italic;line-height:1.35}
p.caption{font-family:"Rubik Mono One",sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase}
.btn{font:15px "Rubik Mono One",sans-serif;background:var(--pink);color:#1a1446;border:3px solid var(--ink);padding:10px 18px;box-shadow:5px 5px 0 var(--shadow);cursor:pointer}
.btn.ghost{background:var(--paper);color:var(--ink)}
.btn.big{font-size:22px;padding:14px 26px}
a{color:var(--ink);font-family:Fraunces,serif;font-size:18px;text-decoration-thickness:3px;text-decoration-color:var(--pink);text-underline-offset:4px}
a.btn{text-decoration:none;display:inline-block}
.card{background:var(--paper);border:3px solid var(--ink);padding:16px;box-shadow:8px 8px 0 var(--pink);font-family:Fraunces,serif}
.sticker{display:inline-block;background:var(--sun);color:var(--ink);border-radius:50%;padding:22px 16px;transform:rotate(10deg);border:3px dashed var(--ink);font-size:18px}
input,textarea,select{font:16px Fraunces,Georgia,serif;border:3px solid var(--ink);padding:8px 10px;background:var(--paper);color:var(--ink);width:100%;box-sizing:border-box}
input.pill{border-radius:999px;background:var(--sun)}
label{font-size:12px;letter-spacing:1px;text-transform:uppercase}
blockquote{border-left:10px solid var(--pink);margin:0;padding:6px 16px;font-family:Fraunces,serif;font-style:italic;font-size:22px}
ul,ol{font-family:Fraunces,serif;font-size:17px;margin:0;padding-left:1.4em}
ul{list-style:square}
ul.checks{list-style:none;padding:0}
ul.checks li::before{content:"\\2736  ";color:var(--pink)}
hr{border:0;height:8px;margin:0;background:repeating-linear-gradient(90deg,var(--ink) 0 14px,transparent 14px 22px)}
hr.wavy{height:10px;background:radial-gradient(circle at 50% 0,transparent 6px,var(--pink) 7px) 0 0/16px 10px}
table{border-collapse:collapse;font-family:Fraunces,serif}
th,td{border:2px solid var(--ink);padding:6px 12px}
th{background:var(--pink);color:#1a1446;font-family:"Rubik Mono One",sans-serif;font-size:12px}
img{border:4px solid var(--ink);box-shadow:6px 6px 0 var(--sun);display:block}
img.tilt{transform:rotate(-3deg)}
code{background:var(--sun);padding:2px 6px;font-family:"DM Mono",monospace}
.badge{display:inline-block;background:var(--ink);color:var(--paper);padding:3px 10px;font-size:12px}
nav a{font-size:15px}`,
'phosphor.css':`/* phosphor.css — sample stylesheet */
:root{--bg:#0d140f;--g:#6dff8b;--dim:#2f6b3c;--amber:#ffb000}
body{font-family:VT323,"Courier New",monospace;color:var(--g)}
h1{font-size:52px;line-height:1;margin:0;background:var(--bg);padding:6px 14px;text-shadow:0 0 8px var(--g)}
h1.amber{color:var(--amber);text-shadow:0 0 10px var(--amber)}
h1.prompt::before{content:"> "}
h2{font-size:34px;margin:0;background:var(--bg);padding:4px 12px;border-bottom:2px solid var(--dim)}
h3{font-size:26px;margin:0;background:var(--bg);padding:2px 10px;color:var(--amber)}
p{font-size:22px;line-height:1.15;margin:0;background:var(--bg);padding:8px 12px}
p.blink::after{content:"\\2588";animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
button{font:24px VT323,monospace;background:var(--bg);color:var(--g);border:2px solid var(--g);padding:4px 16px;cursor:pointer}
button.solid{background:var(--g);color:var(--bg)}
button.amber{border-color:var(--amber);color:var(--amber)}
a{color:var(--amber);font-size:22px;background:var(--bg);padding:2px 6px}
.panel{background:var(--bg);border:2px solid var(--g);padding:12px 14px;font-size:22px;line-height:1.15;box-shadow:0 0 0 4px var(--bg),0 0 18px rgba(109,255,139,.35)}
.panel.amber{border-color:var(--amber);color:var(--amber)}
[data-mode=alarm] .panel{border-color:#ff4040;color:#ff4040;box-shadow:0 0 0 4px var(--bg),0 0 18px rgba(255,64,64,.5)}
input,textarea,select{font:22px VT323,monospace;background:var(--bg);color:var(--g);border:0;border-bottom:2px solid var(--g);padding:6px 8px;width:100%;box-sizing:border-box;caret-color:var(--g)}
input::placeholder,textarea::placeholder{color:var(--dim)}
label{font-size:20px;background:var(--bg);padding:0 6px;color:var(--amber)}
blockquote{margin:0;background:var(--bg);padding:10px 14px;font-size:24px;border-left:4px solid var(--amber)}
ul,ol{background:var(--bg);margin:0;padding:10px 14px 10px 36px;font-size:22px}
ul{list-style:"* "}
hr{border:0;border-top:2px dashed var(--g);margin:0}
table{background:var(--bg);border-collapse:collapse;font-size:20px}
th,td{padding:4px 12px;border:1px solid var(--dim);text-align:left}
th{color:var(--amber)}
img{filter:grayscale(1) sepia(1) hue-rotate(70deg) saturate(3);border:2px solid var(--g);display:block}
code,span.tag{background:var(--g);color:var(--bg);padding:0 6px;font-size:20px}
nav{background:var(--bg);padding:6px 12px;font-size:22px}`,
'bubblegum-os.css':`/* bubblegum-os.css — sample stylesheet */
:root{--sky:#7ec8ff;--blue:#1d6fe0;--candy:#ff7ac4;--lav:#efe9ff;--line:#5b4a9e}
body{font-family:"Pixelify Sans",Verdana,sans-serif;color:#2a1f5c}
h1{font-size:40px;margin:0;font-family:Fraunces,serif;font-weight:800;background:linear-gradient(180deg,#fff 0%,var(--lav) 100%);border:2px solid var(--line);border-radius:14px;padding:8px 18px;box-shadow:inset 0 -4px 0 rgba(91,74,158,.2)}
h1.title-bar{font-family:"Pixelify Sans",sans-serif;font-size:22px;background:repeating-linear-gradient(180deg,var(--lav) 0 2px,#fff 2px 4px);border-radius:0;text-align:center}
h2{font-size:26px;margin:0;color:var(--blue)}
h3{font-size:18px;margin:0;color:var(--candy)}
p{font-size:16px;line-height:1.45;margin:0}
p.bubble{background:#fff;border:2px solid var(--line);border-radius:18px 18px 18px 4px;padding:10px 14px}
.gel{font:600 16px "Pixelify Sans",sans-serif;color:#fff;border:1px solid #0b4fb0;border-radius:999px;padding:9px 22px;background:linear-gradient(180deg,#9fd6ff 0%,#3a8dff 50%,#1d6fe0 51%,#4fa3ff 100%);box-shadow:0 2px 6px rgba(29,111,224,.45),inset 0 1px 0 rgba(255,255,255,.8);cursor:pointer;text-shadow:0 1px 0 rgba(0,0,0,.25)}
.gel.candy{border-color:#c2387f;background:linear-gradient(180deg,#ffc2e4 0%,#ff7ac4 50%,#ef4fa6 51%,#ff8fd0 100%)}
button{font:16px "Pixelify Sans",sans-serif;background:linear-gradient(#fff,var(--lav));border:2px solid var(--line);border-radius:8px;padding:6px 16px;color:var(--line)}
.window{background:#fff;border:2px solid var(--line);border-radius:10px;padding:14px;box-shadow:4px 6px 0 rgba(91,74,158,.25)}
.window.blue{background:var(--sky)}
a{color:var(--blue);font-weight:600}
input,select,textarea{font:16px "Pixelify Sans",sans-serif;border:2px solid var(--line);border-radius:10px;padding:8px 12px;background:#fff;box-shadow:inset 0 2px 3px rgba(91,74,158,.2);width:100%;box-sizing:border-box}
input[type=checkbox]{width:22px;height:22px;accent-color:var(--candy)}
label{font-weight:600;color:var(--line)}
blockquote{margin:0;background:var(--lav);border-radius:14px;padding:12px 16px;font-family:Fraunces,serif;font-style:italic;font-size:19px}
ul,ol{background:#fff;border:2px solid var(--line);border-radius:10px;margin:0;padding:10px 14px 10px 32px}
ul{list-style:circle}
hr{border:0;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--candy),var(--sky));margin:0}
table{border-collapse:separate;border-spacing:0;border:2px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
th{background:var(--sky);padding:6px 12px;text-align:left}
td{padding:6px 12px;border-top:1px solid var(--lav)}
img{border-radius:16px;border:3px solid #fff;box-shadow:0 4px 12px rgba(91,74,158,.4);display:block}
.chip{display:inline-block;background:var(--candy);color:#fff;border-radius:999px;padding:3px 12px;font-size:13px}
code{background:var(--lav);border-radius:6px;padding:2px 6px}`
};

