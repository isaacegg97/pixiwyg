// SECTION: boot
// RULE: missing browser features are named up front instead of failing later.
function checkEnvironment(){
  const missing=[!('adoptedStyleSheets' in Document.prototype)&&'constructable stylesheets',typeof DecompressionStream==='undefined'&&'zip reading (DecompressionStream)',!window.indexedDB&&'IndexedDB storage'].filter(Boolean),bar=$('#envBar');
  if(location.protocol==='file:'){bar.textContent='Opened as a file, so the library stylesheets, color schemes and bundled fonts can’t load. Use the PIXIWYG app, or serve this folder (for example python3 -m http.server) and open it from there.';bar.hidden=false;logErr('environment','opened from file://')}
  else if(missing.length){bar.textContent=`This browser is missing ${missing.join(', ')}. Use the PIXIWYG app or a current Chrome, Edge, Firefox or Safari.`;bar.hidden=false;logErr('environment','missing '+missing.join(', '))}
}
if(/[?&]test(=|&|$)/.test(location.search))window.__pixiwyg={APP_VERSION,ERRS,state:()=>state,prims,newProject,openStored,showTitle,listProjects,storedFiles,packProject,zipFiles,unzip,sortEntries,filesKey,openFiles,readProject,importMarkdown,autoformat,buildExport,expOpt,setCanvas,pageRects,pageOf,imposition,addFile,afterFilesChanged,renderAll,save,select,undo:doUndo,setPalette,schemeFromEntry,SCHEMES:()=>SCHEMES,schemes:()=>schemesReady,addPrim,loadPrims,writePrims,usePrim,backupAll,restoreBackup,toText,cleanHTML,readOnly:()=>readOnly,fetchLib,logErr,ingest,importPrimText,openProjectFile,canvasSummary,claimLock,moveDock,foldDock,dockLayout,renderTree,chooseContext,enterIso,exitIso,iso:()=>iso.id,newStyleGraph,syncNodeSheet,compileStyle,styleClasses,fxLibrary,openStyleEditor,toggleStyleOn,nodeSheet,cleanGraph,seedKit,newDoc,flowDoc,flowDocs,mdChunks,docById,convertOne,convertAll,putBack,addManuscript,showText,openDoc,htmlToMd,encodeAPNG,decodeAPNG,studioOutput,addFrame,goFrame,studio,anyPaint,setWorkspace,ws:()=>document.body.dataset.ws,confineAll,writeBox,elBox,tlSeek,tlItems,tlReset,songOfEl,projectFiles,showFiles,parseMidi,importMidi,songById,newSong,useSong,runTour,songPlaying:()=>PLAYER.playing(),playerShown:()=>!!(PLAYER.main&&PLAYER.main.shown()),cleanPlayer,setSkin,tour:()=>({on:tour.on,i:tour.i,n:tour.steps.length,name:tour.name}),openExample,showWelcome,PROFILES,addLib,SAMPLES,soundfont:()=>soundfont&&{name:soundfont.name,file:soundfont.file,presets:soundfont.presets.length},sfStats,loadSoundFont,parseSF2,sfPlay,seqOut,audio,openSeq,closeSeq,midiBytes,cleanMusic,seqPlay,seqStop,liveOpen,liveClose,liveRefresh,liveFeatures,cleanRefs,addRef,dropRef,openRefs,refsReadme,publishPayload,publishSite,parseMagnet,magnetMode,parseOBJ,parseSTL,m3dBake,m3dLoadFile,m3dLoadSample,m3dPlace,m3dUpdate,m3dRebake,openM3d,m3dLoadFiles,parseGLTF,dpRender,dpSerialize,dpSetView,dpFocus,dpFlush,renderSong:m=>pxRender(m,GMV),pxFx,pxSample,cleanFx,cleanSamples,addSampleFile,openFxPanel,FX_DEFS,trackIn,samplesReady,validateLogic,suggestInteractions,ideasFor,applyIdea,logicChecks,groupSel,ungroupSel,toggleInSel,selIds,groupPrim,useGroupPrim,openTextFx,closeTextFx,tfxPick,tfxApply,TFX,setBoxes,boxSplit,boxRemove,boxCycle,boxRects,boxLayout,boxDrop,boxLeafAt,PXFX,FX,applyFx,pickFx,closeFx,fxs:()=>fxs,selAll,selNone,selClear,selCrop,flipCanvas,rotate90,scaleBy,saveGif,needGifenc,sbuf:()=>sbuf,parseMTL,px3dDrag,m3dSavePrim,m3dUsePrim,m3dPaint,m3dSetTexture,m3dGuide,m3dBoxUV,m3d:()=>m3d,openSset,ssetAddFiles,primsForTag,renderCatPrims,ssetAddLib,loadSset,setPlay,playing:()=>!!playing,insertCalculator,chooseStyle,cleanGraph,animSpec,defaultAnimGraph,openAnimEditor,openLogicEditor,closeNodeEditor,hostOf,setSide,openStructWindow,pushUndo,measure,makeSymbol,placeSymbol,a11yCheck,renderChecks,resetOwn,detachSym,deleteSym,symById,gcBlobs,tx,putProject,dropProject,saveNow,saveVersion,listVersions,restoreVersion,dropVersion,openVersions,themeTemplate,loadAppTheme,forgetAppTheme,setTheme,cleanThemeCSS,APP_TOKENS,BUILTIN_THEMES,theme:()=>theme,openSettings,closeSettings,wrFindOpen,wrSetView,wrSetZoom,renderBackground,seedKit,openRuleAsNodes,compileStyle,goPage,addPage,deletePage,setPageProp,addNav,siteTree,multiPage,curPage:()=>curPage(),exportSiteFiles,playGo,tourStep:()=>{const s=tour.steps[tour.i];return s?{title:s.title,target:s.target||null,spots:tourRects(s).length,ws:document.body.dataset.ws,last:!!s.last}:null},tourNext,PROFILE_IDS:()=>Object.keys(PROFILES),chooseProfile,themeCards,
  addLayer,dupLayer,delLayer,mergeDown,movePaintLayer,setActiveLayer,setLayerProp,toggleLayer:i=>toggleLayer(studio.layers[i]),flatURL,layerBlank,sUndo,sRedo,
  layers:()=>studio.layers.map(L=>({id:L.id,name:L.name,opacity:L.opacity,blend:L.blend,hidden:L.hidden,active:L===activeLayer()})),movePal:(k,to,at)=>movePal(document.querySelector(`.spal[data-pal=${k}]`),to,at),togglePalettes,sZoomTo,sZoomFit,viewScale,
  curBrush,selectBrush,newBrush,editBrush,openBrushEditor,closeBrushEditor,allBrushes,cleanBrush,brushPreview,BUILTIN_BRUSHES,brushStylesChanged,tipCache,styleClasses,
  fxApply,layerFxOn,openLayerStyle,studioLayer:i=>studio.layers[i],studioOutputs,fxPartner,m3dScene:()=>m3d.scene,m3dSceneFromSrc,cleanScene,m3dSceneMesh,m3dStartScene,m3dFlush,m3dSceneSTL,textSolid,vp:()=>vp,setUi,ui:()=>({mode:ui.mode,on:ui.on,home:!$('#xmb').hidden}),xmbOpen,xmbClose,xmbCat:()=>XMB.cats()[XMB.c].id,xmbItems:()=>XMB.items.map(i=>i.name),zoom:()=>Z,songIdeas,IDEA_GENRES,IDEA_MODES,openIdeas,meterGroups,barTicks,beatTicks,gridTicks,pxRender,GM,GMV,DRUMS,songMp3};
(async()=>{
  checkEnvironment();
  initPanels();fitStage();
  renderHelp();
  // COMPAT: bundled web font copies so the editor and previews work without Google Fonts.
  fetchLib('fonts.css').then(t=>{const st=document.createElement('style');st.textContent=t;document.head.append(st)}).catch(()=>{});
  studioInit();schemesReady=loadSchemes();
  setColor(state.color);setBg(state.bg);setSize(state.size);setTool(state.tool);renderOpts();
  // COMPAT: on first visit the pre-projects page becomes a project; otherwise the demo is built only to stock the
  //   starter primitives.
  if(!(await listProjects()).length&&!lsGet('pixiwyg.migrated',null)){
    projLoading=true;resetProject();fitStage();
    const old=await load();
    if(!old){await seed();if(!(await loadPrims()))await seedPrims();delete state._seedArt;resetProject();fitStage();projLoading=false;lsSet('pixiwyg.migrated','1');await seedKit().catch(()=>{});renderPrims();showTitle();maybeWelcome();return}
    state.project={id:nid('p'),name:'My page',created:Date.now(),modified:Date.now()};
    if(!(await loadPrims()))await seedPrims();delete state._seedArt;
    if(state._oldPainting){const o=state._oldPainting;delete state._oldPainting;if(!(await isBlankImage(o.src)))addPrim({kind:'drawing',name:'Painting from before',data:o,collection:''},{quiet:true});else state.bgd.layers=state.bgd.layers.filter(l=>l.src!==o.src)}
    renderProject();projLoading=false;await saveNow();lsSet('pixiwyg.migrated','1');
  }else if(!(await loadPrims()))await seedPrims();
  await seedKit().catch(()=>{});
  // PERF: thumbnail cache in IndexedDB is dropped wholesale past ~2000 entries.
  setTimeout(()=>gcBlobs().catch(()=>{}),8000);
  tx(['kv'],'readonly',st=>st.getAllKeys()).then(keys=>{const t=(keys||[]).filter(k=>String(k).startsWith('thumb:'));if(t.length>2000)return tx(['kv'],'readwrite',st=>{for(const k of t)st.delete(k)})}).catch(()=>{});
  renderPrims();
  showTitle();maybeWelcome();
})();
})();