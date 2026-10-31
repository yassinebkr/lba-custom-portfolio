/** Original portfolio rooms. No game-derived map data, art, or copyrighted characters. */
import {scene} from './rules.mjs';
const display=(id,name,accent,projects)=>({
 id,name,width:10,depth:10,start:{x:5,z:8},accent,projects
});
const item=(id,x,z,label,category,description,kind='terminal',url=null)=>({
 id,x,z,label,category,description,kind,url
});
export const ROOMS=[
 {...scene,id:'showroom',name:'Project Atlas / Showroom',accent:'#83e8d6'},
 display('origin','Origin / Introduction','#b7cfa6',[
  item('about',2,2,'About the Maker','BACKGROUND','From hands-on work to electronics, embedded systems and original creative tools.','character'),
  item('skills',7,2,'Practical Skills','WORKSHOP','PCB design, electronics prototyping, CAD, firmware, test instrumentation and technical research.','camera'),
  item('open-source',2,7,'Open Source','CODE / COLLABORATION','Projects are documented for reproducibility and shared learning.','terminal','https://github.com/yassinebkr'),
  item('connect',7,7,'Get in Touch','CONTACT','Project repositories and contact details are accessible from the GitHub profile.','antenna','https://github.com/yassinebkr')
 ]),
 display('imaging','Electronics / Imaging','#86b8f1',[
  item('imx283',2,2,'RAW Imaging','CINEMA / ELECTRONICS','A Raspberry Pi 5 cinema-camera experiment with Sony IMX283 sensor and RAW capture.','camera','https://github.com/yassinebkr/cinematepi5'),
  item('color',7,2,'Color Pipeline','IMAGING','Color science, LUTs, white balance and preview tools for the camera.','terminal'),
  item('hud',2,7,'Camera UI','INTERFACE','On-screen camera controls, peaking, zebras and an experimental responsive preview.','terminal'),
  item('hardware',7,7,'Sensor Hardware','EMBEDDED','Connecting image sensors, storage and camera peripherals to a small computing platform.','antenna')
 ]),
 display('fabrication','Workshop / Fabrication','#e7bd8d',[
  item('cad',2,2,'CAD & Design','MECHANICAL','Mechanical design and iterative fabrication of original enclosures and parts.','camera'),
  item('printing',7,2,'3D Printing','MAKER','CoreXY and Klipper-based printing, calibration, material testing and iteration.','terminal'),
  item('machining',2,7,'CNC Workshop','FABRICATION','Local machining, electronics assembly and prototyping workflows.','camera'),
  item('mask',7,7,'Custom Geometry','3D / SCANNING','Building fitted geometry from a cleaned 3D scan and sculpted surfaces.','terminal')
 ]),
 display('field','Field Lab / Telemetry','#c0e4aa',[
  item('lora-radio',2,2,'LoRa Telemetry','RADIO / RF','Embedded 868 MHz telemetry with field trials, antenna design and packet handling.','antenna'),
  item('orientation',7,2,'Motion Sensing','IMU / CONTROL','Inertial sensors, calibration, orientation measurement and motion processing.','camera'),
  item('navigation',2,7,'GNSS Navigation','EMBEDDED','GNSS acquisition and remote navigation data over long-range links.','terminal'),
  item('parafoil',7,7,'Parafoil Guidance','AUTONOMOUS SYSTEMS','Exploring a recoverable guided parafoil platform and its telemetry architecture.','terminal')
 ]),
 display('interfaces','AI / Interfaces','#c7b5ed',[
  item('agent-ui',2,2,'Adaptive UI','INTERFACE DESIGN','Dynamic workspaces organized around the actual task and the user’s attention.','terminal'),
  item('agent-team',7,2,'Multi-Agent Work','AI SYSTEMS','Specialized agents, visible progress and evidence-based execution.','terminal'),
  item('shell',2,7,'ShellFolio','WEB / EXPERIENCE','An interactive terminal-inspired portfolio with animations and keyboard interaction.','terminal','https://github.com/yassinebkr/ShellFolio'),
  item('design',7,7,'Design Systems','UX / PRODUCT','Readable layouts, visual hierarchy, reusable components and robust interaction patterns.','camera')
 ])
];
export function roomById(id){return ROOMS.find(r=>r.id===id)||null;}
