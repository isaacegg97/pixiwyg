// SECTION: element kinds (TAGS) and the reset every element starts from
const IMG_PH='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#7ec8ff"/><circle cx="185" cy="45" r="22" fill="#ffd23f"/><path d="M0 160 70 70 120 125 160 90 240 160Z" fill="#2b2bd9"/><path d="M0 160 40 120 90 160Z" fill="#ff4fa3"/></svg>');

const TAGS={
  h1:{content:'Big Headline',w:420},
  h2:{content:'Section title',w:320},
  h3:{content:'Small heading'},
  p:{content:'A paragraph of body text. Double-click to edit it, drag to move it, and hover a style in the preview window to try it on.',w:320},
  button:{content:'Click me'},
  a:{content:'A link somewhere',attrs:{href:'#'}},
  input:{void:true,attrs:{placeholder:'Type here…'},w:240},
  textarea:{content:'',attrs:{placeholder:'Longer text…',rows:'3'},w:260,noedit:true},
  select:{content:'<option>First choice</option><option>Second choice</option>',noedit:true},
  label:{content:'Field label'},
  ul:{content:'<li>Glue sticks</li><li>Glitter</li><li>Stylesheets</li>',w:240},
  ol:{content:'<li>Upload CSS</li><li>Place things</li><li>Pick looks</li>',w:240},
  blockquote:{content:'Every pixel is a choice.',w:320},
  table:{content:'<thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody><tr><td>Stamps</td><td>12</td></tr><tr><td>Brushes</td><td>4</td></tr></tbody>'},
  img:{void:true},
  hr:{void:true,w:300},
  div:{content:'A box. Frameworks usually style boxes through classes like .card or .alert.',w:280},
  span:{content:'label'},
  code:{content:'npm run zine'},
  nav:{content:'<a href="#">Home</a> · <a href="#">Shop</a> · <a href="#">About</a>'},
  pre:{content:'$ npm run zine\nprinting in pink…',w:320},
};
const VOID=new Set(['input','img','hr','br','meta','link','source','area','col','embed','wbr','track','base','param']);

// RULE: RESET_CSS also carries the text-effect classes (textfx.js): it is in every element and every export.
const RESET_CSS='.__html,.__body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;max-width:none!important;width:auto!important;border:0!important;overflow:visible!important;display:block!important;position:static!important;transform:none!important;box-shadow:none!important}[contenteditable=true]{outline:2px dashed #ff2e88;outline-offset:3px;cursor:text}.pxfx-tilt,.pxfx-wiggle,.pxfx-bounce,.pxfx-wave>span,.pxfx-ransom>span{display:inline-block}.pxfx-wiggle{animation:pxfx-wiggle .5s ease-in-out infinite alternate}@keyframes pxfx-wiggle{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}.pxfx-wave>span{animation:pxfx-wave 1.2s ease-in-out infinite;animation-delay:calc(var(--i,0)*.08s)}@keyframes pxfx-wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-.3em)}}.pxfx-bounce{animation:pxfx-bounce .8s cubic-bezier(.3,1.6,.6,1) infinite alternate}@keyframes pxfx-bounce{to{transform:translateY(-.25em) scale(1.08)}}.pxfx-blink{animation:pxfx-blink 1s steps(1) infinite}@keyframes pxfx-blink{50%{opacity:0}}.pxfx-rainbow{animation:pxfx-rainbow 3s linear infinite}@keyframes pxfx-rainbow{0%,100%{color:#ff2e88}20%{color:#ff9f1c}40%{color:#e6c800}60%{color:#2ec4b6}80%{color:#3a86ff}}@media (prefers-reduced-motion:reduce){[data-pxfx],[data-pxfx]>span{animation:none!important}}';
const RESET=new CSSStyleSheet();RESET.replaceSync(RESET_CSS);

