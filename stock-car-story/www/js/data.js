/* ============================================================
   STOCK CAR STORY — content database
   Mirrors the full Grand Prix Story systems, stock-car themed.
   Money is stored in $K everywhere.  RP = research points.
   ============================================================ */
"use strict";

/* Aptitude grades → multipliers (GPS used ◎ ○ △ ✕) */
const APT = { S: 1.25, A: 1.12, B: 1.0, C: 0.85, D: 0.68 };
const APT_SYM = { S: "◎", A: "○", B: "○", C: "△", D: "✕" };

/* Surface families a track can be */
const SURF = { short: "Short Track", mid: "Intermediate", ss: "Superspeedway", road: "Road Course", street: "Street Circuit" };

/* ---------- CARS (chassis) ----------
   res  = research points to unlock blueprint
   cost = $K to build
   exp  = part slots
   ad   = advertising/appeal, rep = repair speed grade
   unlock: {t:'start'|'date'|'race'|'sponsor'|'carUp'|'series', ...}          */
const CARS = [
 {id:"street", name:"Street Stocker", rank:"E", res:0,   cost:100, dur:100, spd:35,  acc:30,  hdl:60,  exp:2, ad:"B", rep:"A",
  apt:{short:"A",mid:"C",ss:"D",road:"C",street:"B"}, paint:true,  unlock:{t:"start"}},
 {id:"late",   name:"Late Model",     rank:"D", res:60,  cost:300, dur:110, spd:65,  acc:60,  hdl:120, exp:2, ad:"B", rep:"A",
  apt:{short:"S",mid:"B",ss:"C",road:"C",street:"B"}, paint:true,  unlock:{t:"race",id:"pineridge"}},
 {id:"dirtmod",name:"Short Track Modified", rank:"D", res:40,  cost:300, dur:140, spd:70,  acc:60,  hdl:90,  exp:3, ad:"B", rep:"B",
  apt:{short:"A",mid:"C",ss:"D",road:"C",street:"A"}, paint:true,  unlock:{t:"carUp",id:"street",pct:20}},
 {id:"dragster",name:"Dragster Stock",rank:"D", res:200, cost:0,   dur:60,  spd:90,  acc:80,  hdl:50,  exp:2, ad:"B", rep:"A",
  apt:{short:"B",mid:"B",ss:"C",road:"D",street:"D"}, paint:true,  unlock:{t:"race",id:"saltflats"}},
 {id:"truck",  name:"Race Truck",     rank:"C", res:80,  cost:500, dur:120, spd:90,  acc:70,  hdl:70,  exp:3, ad:"S", rep:"A",
  apt:{short:"A",mid:"B",ss:"C",road:"C",street:"C"}, paint:false, unlock:{t:"sponsor",id:"bigrig"}},
 {id:"pony",   name:"Pony Coupe",     rank:"C", res:280, cost:500, dur:100, spd:70,  acc:70,  hdl:80,  exp:3, ad:"B", rep:"B",
  apt:{short:"B",mid:"B",ss:"B",road:"A",street:"A"}, paint:false, unlock:{t:"race",id:"hogback"}},
 {id:"sonic",  name:"Sonic Stocker",  rank:"C", res:140, cost:600, dur:130, spd:90,  acc:100, hdl:160, exp:2, ad:"B", rep:"B",
  apt:{short:"A",mid:"A",ss:"C",road:"A",street:"S"}, paint:true,  unlock:{t:"carUp",id:"late",pct:50}},
 {id:"torpedo",name:"Torpedo Body",   rank:"C", res:100, cost:400, dur:90,  spd:130, acc:150, hdl:80,  exp:2, ad:"B", rep:"B",
  apt:{short:"C",mid:"A",ss:"A",road:"C",street:"D"}, paint:true,  unlock:{t:"carUp",id:"dragster",pct:50}},
 {id:"proto",  name:"Proto Stocker",  rank:"C", res:100, cost:600, dur:200, spd:110, acc:105, hdl:130, exp:3, ad:"B", rep:"B",
  apt:{short:"B",mid:"B",ss:"B",road:"B",street:"B"}, paint:true,  unlock:{t:"carUp",id:"dirtmod",pct:50}},
 {id:"aero",   name:"Aero Coupe",     rank:"B", res:250, cost:900, dur:160, spd:140, acc:150, hdl:220, exp:3, ad:"B", rep:"B",
  apt:{short:"B",mid:"A",ss:"B",road:"A",street:"A"}, paint:true,  unlock:{t:"carUp",id:"sonic",pct:50}},
 {id:"spiral", name:"Superbird",      rank:"B", res:200, cost:800, dur:120, spd:200, acc:190, hdl:100, exp:3, ad:"B", rep:"B",
  apt:{short:"C",mid:"A",ss:"S",road:"C",street:"D"}, paint:true,  unlock:{t:"carUp",id:"torpedo",pct:50}},
 {id:"hauler", name:"Big Block Brawler",rank:"A",res:800, cost:280, dur:280, spd:100, acc:250, hdl:50,  exp:4, ad:"B", rep:"C",
  apt:{short:"A",mid:"B",ss:"C",road:"C",street:"D"}, paint:false, unlock:{t:"sponsor",id:"piggy"}},
 {id:"gen4",   name:"Gen-4 Cup Car",  rank:"A", res:200, cost:900, dur:240, spd:160, acc:150, hdl:155, exp:4, ad:"S", rep:"B",
  apt:{short:"A",mid:"S",ss:"A",road:"A",street:"A"}, paint:true,  unlock:{t:"carUp",id:"proto",pct:50}},
 {id:"moonshine",name:"Moonshine Special",rank:"S",res:12,cost:10, dur:10,  spd:210, acc:260, hdl:230, exp:4, ad:"S", rep:"S",
  apt:{short:"S",mid:"A",ss:"A",road:"B",street:"B"}, paint:false, unlock:{t:"race",id:"thunderroad"}},
 {id:"nextgen",name:"NextGen Cup",    rank:"S", res:400, cost:1200,dur:160, spd:200, acc:180, hdl:190, exp:4, ad:"B", rep:"B",
  apt:{short:"A",mid:"S",ss:"S",road:"S",street:"S"}, paint:true,  unlock:{t:"carUp2",a:"spiral",b:"aero",pct:50}},
];

/* ---------- PARTS ----------
   fx keys: spd acc hdl dur ad(advert) drv(driver assist) sc(supercharge)
            turbo brake anl(analysis eff) xp  + surface bonuses on/off/ice→
            short/mid/ss/road flat bonuses                                  */
const PARTS = [
 // --- Engine: the main speed ladder ---
 {id:"v6",     name:"350 Small Block", cat:"Engine", rank:"D", res:30,  cost:100, fx:{spd:20,acc:5},
  desc:"An honest short-track motor.", unlock:{t:"date",y:1,m:6}},
 {id:"v8",     name:"400 V8",          cat:"Engine", rank:"C", res:60,  cost:180, fx:{spd:40,acc:10},
  desc:"More cubic inches, more corner exit.", unlock:{t:"partUp",id:"v6",pct:80}},
 {id:"v10",    name:"427 Big Block",   cat:"Engine", rank:"B", res:100, cost:280, fx:{spd:62,acc:16},
  desc:"Serious power for the mile-and-a-halfs.", unlock:{t:"partUp",id:"v8",pct:80}},
 {id:"v12",    name:"850hp Cup V8",    cat:"Engine", rank:"A", res:170, cost:420, fx:{spd:86,acc:22},
  desc:"A full Cup-spec engine.", unlock:{t:"partUp",id:"v10",pct:100}},

 // --- Tyres: grip, and what suits the surface ---
 {id:"radial", name:"Street Radials",  cat:"Tyres",  rank:"D", res:20,  cost:40,  fx:{acc:5,hdl:8},
  desc:"Cheap and durable. You will outgrow them.", unlock:{t:"date",y:1,m:6}},
 {id:"sport",  name:"Sport Slicks",    cat:"Tyres",  rank:"C", res:70,  cost:110, fx:{acc:14,hdl:24,short:8},
  desc:"Bites hard on the short tracks.", unlock:{t:"partUp",id:"radial",pct:80}},
 {id:"slick",  name:"Speedway Slicks", cat:"Tyres",  rank:"B", res:130, cost:210, fx:{acc:26,hdl:30,mid:10,ss:12},
  desc:"Built for sustained speed.", unlock:{t:"partUp",id:"sport",pct:80}},
 {id:"rain",   name:"Rain Radials",    cat:"Tyres",  rank:"C", res:40,  cost:150, fx:{hdl:16,road:22},
  desc:"For the road courses.", unlock:{t:"race",id:"hogback"}},

 // --- Aero: downforce against drag ---
 {id:"wing",   name:"Rear Spoiler",    cat:"Aero",   rank:"C", res:50,  cost:80,  fx:{spd:-4,hdl:22},
  desc:"Plants the rear. Costs a little top end.", unlock:{t:"date",y:2,m:3}},
 {id:"bigwing",name:"Tall Spoiler",    cat:"Aero",   rank:"B", res:95,  cost:160, fx:{spd:-18,hdl:44},
  desc:"Maximum grip for the tight stuff.", unlock:{t:"partUp",id:"wing",pct:80}},
 {id:"drafter",name:"Draft Package",   cat:"Aero",   rank:"A", res:150, cost:260, fx:{spd:22,hdl:6}, note:"Draft +25%",
  desc:"Slippery in traffic — made for superspeedways.", unlock:{t:"sponsor",id:"honza"}},

 // --- Chassis: handling and durability ---
 {id:"susp",   name:"Race Suspension", cat:"Chassis",rank:"C", res:50,  cost:70,  fx:{hdl:16,dur:14},
  desc:"Proper shocks and springs.", unlock:{t:"date",y:1,m:10}},
 {id:"ltchas", name:"Lightweight Frame",cat:"Chassis",rank:"B",res:90,  cost:140, fx:{spd:10,acc:12,dur:20},
  desc:"Less weight everywhere.", unlock:{t:"partUp",id:"susp",pct:80}},
 {id:"cage",   name:"Chromoly Cage",   cat:"Chassis",rank:"A", res:130, cost:190, fx:{dur:60,hdl:8},
  desc:"Survives contact — and the Big One.", unlock:{t:"partUp",id:"ltchas",pct:80}},

 // --- Drivetrain ---
 {id:"gear4",  name:"4-Speed Gearbox", cat:"Drive",  rank:"D", res:30,  cost:60,  fx:{acc:12},
  desc:"Better ratios off the corner.", unlock:{t:"date",y:1,m:10}},
 {id:"gear6",  name:"Close-Ratio Box", cat:"Drive",  rank:"B", res:100, cost:180, fx:{acc:26,spd:8},
  desc:"Keeps the motor in its window.", unlock:{t:"partUp",id:"gear4",pct:80}},

 // --- Pit equipment: stop time and fuel range ---
 {id:"pitgun", name:"Turbo Lug Gun",   cat:"Pit",    rank:"C", res:40,  cost:90,  fx:{pit:22},
  desc:"Seconds off every stop.", unlock:{t:"sponsor",id:"wrench"}},
 {id:"fuelcell",name:"Long-Run Cell",  cat:"Pit",    rank:"C", res:50,  cost:120, fx:{fuel:30,dur:10},
  desc:"Stretches a fuel run.", unlock:{t:"date",y:2,m:8}},
];

/* ---------- DRIVERS ---------- (hire cost $K, salary derived) */
const DRIVERS = [
 {n:"Rusty Axles",    c:0,    pd:14,sh:15,st:16,ap:14,tc:12,an:12},
 {n:"Bo Bumper",      c:25,   pd:14,sh:19,st:15,ap:17,tc:16,an:12},
 {n:"Tak Goto",       c:30,   pd:12,sh:17,st:12,ap:18,tc:21,an:13},
 {n:"Dee Doria",      c:30,   pd:50,sh:40,st:43,ap:33,tc:20,an:26},
 {n:"Oil Olson",      c:40,   pd:15,sh:10,st:16,ap:16,tc:15,an:14},
 {n:"Iggy Suzuki",    c:40,   pd:18,sh:16,st:16,ap:18,tc:17,an:13},
 {n:"Deb Steppe",     c:50,   pd:12,sh:27,st:25,ap:21,tc:17,an:24},
 {n:"Pat Posh",       c:60,   pd:21,sh:25,st:31,ap:18,tc:16,an:21},
 {n:"Ukyo Pajama",    c:90,   pd:23,sh:31,st:28,ap:28,tc:24,an:33},
 {n:"Polly Pan",      c:100,  pd:22,sh:28,st:25,ap:38,tc:26,an:34},
 {n:"Max Muffler",    c:120,  pd:34,sh:38,st:39,ap:44,tc:20,an:17},
 {n:"Tom Booze",      c:120,  pd:17,sh:29,st:31,ap:39,tc:24,an:26},
 {n:"Kathy Camshaft", c:150,  pd:24,sh:31,st:33,ap:31,tc:43,an:28},
 {n:"Bony Barko",     c:150,  pd:37,sh:31,st:41,ap:42,tc:48,an:18},
 {n:"Eva Eng",        c:260,  pd:24,sh:36,st:36,ap:33,tc:41,an:32},
 {n:"Jo Aldente",     c:350,  pd:38,sh:29,st:53,ap:49,tc:44,an:36},
 {n:"Huck Norris",    c:400,  pd:37,sh:46,st:58,ap:38,tc:43,an:23},
 {n:"Koala Lamper",   c:500,  pd:23,sh:25,st:20,ap:42,tc:34,an:22},
 {n:"Serena Sun",     c:500,  pd:27,sh:48,st:36,ap:51,tc:33,an:49},
 {n:"King Ackbar",    c:600,  pd:31,sh:40,st:38,ap:34,tc:56,an:33},
 {n:"Becky Blue",     c:770,  pd:37,sh:27,st:33,ap:21,tc:36,an:46},
 {n:"Mike Shoe",      c:800,  pd:35,sh:37,st:31,ap:29,tc:39,an:21},
 {n:"Oby Bun",        c:800,  pd:44,sh:34,st:34,ap:56,tc:36,an:27},
 {n:"F. Alfonso",     c:900,  pd:44,sh:40,st:52,ap:31,tc:29,an:52},
 {n:"Ben Jutton",     c:950,  pd:40,sh:45,st:41,ap:38,tc:35,an:68},
 {n:"Black Flag Ninja",c:950, pd:50,sh:50,st:50,ap:50,tc:50,an:70},
 {n:"Kimi Kone",      c:1800, pd:23,sh:28,st:63,ap:50,tc:43,an:36},
 {n:"Maria Sharp",    c:2000, pd:27,sh:30,st:37,ap:54,tc:43,an:53},
 {n:"Nic Nosberg",    c:2200, pd:35,sh:49,st:33,ap:35,tc:37,an:59},
 {n:"Ginny Cotton",   c:2500, pd:58,sh:44,st:56,ap:25,tc:26,an:53},
 {n:"Lou Hamton",     c:2500, pd:40,sh:80,st:51,ap:49,tc:49,an:35},
 {n:"Sep Pang",       c:2800, pd:47,sh:57,st:42,ap:87,tc:31,an:30},
 {n:"S. Bettel",      c:3000, pd:53,sh:44,st:49,ap:28,tc:22,an:82},
 {n:"Ireton Cena",    c:3000, pd:74,sh:27,st:55,ap:37,tc:68,an:60},
 {n:"Mick Tesla",     c:3500, pd:39,sh:49,st:39,ap:36,tc:24,an:50},
 {n:"Kairobot",       c:4000, pd:79,sh:69,st:68,ap:35,tc:57,an:71},
];

/* ---------- CREW (mechanics) ---------- salary $K/mo at L1, ×3 at L5 */
const CREW = [
 {n:"Gus Grease",   s:2.0, ap:19,tc:10,an:5},
 {n:"Ty Flats",     s:2.0, ap:13,tc:15,an:13},
 {n:"Will Wheels",  s:2.5, ap:7, tc:15,an:28},
 {n:"Axle Rows",    s:2.5, ap:14,tc:30,an:10},
 {n:"Speed Smith",  s:2.5, ap:4, tc:11,an:20},
 {n:"Mia Mile",     s:3.0, ap:24,tc:3, an:16},
 {n:"Skid McGee",   s:3.0, ap:11,tc:25,an:9},
 {n:"Panica D.",    s:3.5, ap:8, tc:23,an:16},
 {n:"Gus O'Leen",   s:3.5, ap:31,tc:21,an:19},
 {n:"Shea Shift",   s:3.5, ap:25,tc:26,an:12},
 {n:"Han Polo",     s:3.5, ap:27,tc:27,an:26},
 {n:"Pup E. Luv",   s:4.0, ap:30,tc:13,an:20},
 {n:"Hub Capp",     s:4.0, ap:24,tc:17,an:29},
 {n:"Crash Taylor", s:4.0, ap:7, tc:6, an:35},
 {n:"Tom Edson",    s:4.5, ap:9, tc:35,an:21},
 {n:"Leo D. Vin",   s:4.5, ap:29,tc:31,an:26},
 {n:"Diane Ride",   s:4.5, ap:28,tc:21,an:34},
 {n:"Mick Myson",   s:5.0, ap:40,tc:3, an:31},
 {n:"Alf Lobel",    s:5.0, ap:10,tc:58,an:21},
 {n:"Jackie Tan",   s:6.0, ap:16,tc:27,an:52},
 {n:"Mo Andretti",  s:7.0, ap:46,tc:37,an:18},
 {n:"Boba Fatt",    s:8.0, ap:25,tc:58,an:48},
 {n:"Chimpan Z",    s:30.0,ap:49,tc:49,an:44},
];

/* ---------- SPONSORS ----------
   base = base payout $K per 6-month contract
   need = advertising points required to fill the gauge
   rw   = reward on filling: {t:'part'|'car'|'train'|'cash'|'rp', id/amt}   */
const SPONSORS = [
 {id:"gator",   n:"Gator Grip Tires", cat:"Auto",  base:72,   need:80,  rw:{t:"part",id:"susp"}},
 {id:"dry",     n:"Dry Springs Water",cat:"Service",base:137, need:105, rw:{t:"cash",amt:400}},
 {id:"mocha",   n:"Mocha Cola",       cat:"Food",  base:205,  need:130, rw:{t:"cash",amt:500}},
 {id:"carbucks",n:"Carbucks Coffee",  cat:"Finance",base:365, need:155, rw:{t:"cash",amt:700}},
 {id:"cluck",   n:"Colonel Cluck's",  cat:"Food",  base:305,  need:180, rw:{t:"rp",amt:40}},
 {id:"frogger", n:"Froggerade",       cat:"Food",  base:300,  need:205, rw:{t:"train",id:"dragrace"}},
 {id:"sponge",  n:"Spongecorp",       cat:"Tech",  base:325,  need:230, rw:{t:"rp",amt:60}},
 {id:"racetrax",n:"Race Trax",        cat:"Service",base:400, need:255, rw:{t:"cash",amt:600}},
 {id:"cheapy",  n:"Cheapy P's",       cat:"Tech",  base:437,  need:280, rw:{t:"rp",amt:90}},
 {id:"dairy",   n:"Dairy Duke",       cat:"Food",  base:441,  need:305, rw:{t:"train",id:"pwrslide"}},
 {id:"dull",    n:"Dull Computers",   cat:"Tech",  base:468,  need:330, rw:{t:"train",id:"rocket"}},
 {id:"milky",   n:"Milky Milk",       cat:"Food",  base:495,  need:355, rw:{t:"rp",amt:120}},
 {id:"bobs",    n:"Bob's Drugs",      cat:"Food",  base:525,  need:380, rw:{t:"train",id:"aerobics"}},
 {id:"adnd",    n:"AD&D Wireless",    cat:"Service",base:560, need:405, rw:{t:"train",id:"watchvids"}},
 {id:"chimp",   n:"Chimp Labs",       cat:"Tech",  base:330,  need:430, rw:{t:"cash",amt:900}},
 {id:"wrench",  n:"Wrench Bros.",     cat:"Auto",  base:425,  need:455, rw:{t:"part",id:"pitgun"}},
 {id:"river",   n:"River Bank",       cat:"Finance",base:567, need:480, rw:{t:"train",id:"shopclass"}},
 {id:"honza",   n:"Honza Cars",       cat:"Auto",  base:450,  need:505, rw:{t:"part",id:"drafter"}},
 {id:"nights",  n:"Nights Inn",       cat:"Service",base:495, need:530, rw:{t:"train",id:"gearshift"}},
 {id:"bigrig",  n:"Big Rig Diesel",   cat:"Auto",  base:577,  need:555, rw:{t:"car",id:"truck"}},
 {id:"microsloth",n:"Microsloth",     cat:"Finance",base:755, need:580, rw:{t:"train",id:"drift"}},
 {id:"piggy",   n:"Piggy Bank Ins.",  cat:"Finance",base:925, need:605, rw:{t:"car",id:"hauler"}},
 {id:"kairo",   n:"Retro Games Co.",  cat:"Finance",base:1175,need:630, rw:{t:"cash",amt:2400}},
];

/* ---------- TRAINING ----------
   e = energy, c = cost $K, fx = stat gains                                  */
const TRAININGS = [
 {id:"jog",      n:"Morning Jog",   c:5,   e:12, fx:{pd:2,sh:1},              unlock:{t:"start"}},
 {id:"joyride",  n:"Joyride",       c:12,  e:18, fx:{pd:2,sh:2,st:2},         unlock:{t:"start"}},
 {id:"read",     n:"Read Manuals",  c:10,  e:14, fx:{tc:3,an:3},              unlock:{t:"start"}},
 {id:"dance",    n:"Line Dance",    c:14,  e:16, fx:{ap:4,sh:1},              unlock:{t:"start"}},
 {id:"weights",  n:"Weight Room",   c:22,  e:24, fx:{pd:4,st:1},              unlock:{t:"date",y:2,m:1}},
 {id:"sim",      n:"Race Simulator", c:38, e:26, fx:{st:4,an:2,tc:1},         unlock:{t:"date",y:3,m:1}},
 {id:"dragrace", n:"Drag Race",     c:45,  e:34, fx:{pd:6,sh:4},              unlock:{t:"sponsor",id:"frogger"}},
 {id:"pwrslide", n:"Traffic Drill",  c:52,  e:36, fx:{st:7,sh:3},              unlock:{t:"sponsor",id:"dairy"}},
 {id:"rocket",   n:"Rocket Science",c:60,  e:30, fx:{tc:8,an:5},              unlock:{t:"sponsor",id:"dull"}},
 {id:"aerobics", n:"Pit Aerobics",  c:48,  e:40, fx:{pd:4,sh:4,st:4},         unlock:{t:"sponsor",id:"bobs"}},
 {id:"watchvids",n:"Watch Race Tape",c:44, e:22, fx:{an:8,st:3},              unlock:{t:"sponsor",id:"adnd"}},
 {id:"shopclass",n:"Shop Class",    c:56,  e:28, fx:{tc:9,ap:2},              unlock:{t:"sponsor",id:"river"}},
 {id:"gearshift",n:"Gear Shift Drill",c:64,e:38, fx:{sh:9,pd:2},              unlock:{t:"sponsor",id:"nights"}},
 {id:"drift",    n:"Road Course Camp",c:80, e:44, fx:{st:10,sh:4,ap:3},        unlock:{t:"sponsor",id:"microsloth"}},
 {id:"mediaday", n:"Media Day",     c:30,  e:16, fx:{ap:8},                   unlock:{t:"date",y:2,m:6}},
];

/* ---------- TRACKS ----------
   geo: shape preset consumed by track.js
   len = track length in miles (display), laps, fee $K, prize array $K       */
const TRACKS = [
 {id:"pineridge",  n:"Pine Ridge Bullring", surf:"short", geo:"paperclip", mi:0.53, laps:30, fee:5,
  prize:[80,40,24,14,8,4],    fans:60,  ad:40,  unlock:{t:"start"}, desc:"A flat half-mile paperclip. Bumpers get used."},
 {id:"clayton",    n:"Clayton County Speedway", surf:"short", geo:"bowl",     mi:0.50, laps:30, fee:8,
  prize:[110,55,33,18,10,5],  fans:90,  ad:55,  unlock:{t:"race",id:"pineridge"}, desc:"A tight, high-banked half-mile. Bumpers get used."},
 {id:"thunderbowl",n:"Thunder Bowl",        surf:"short", geo:"bowl",      mi:0.53, laps:40, fee:12,
  prize:[140,70,42,24,13,6],  fans:110, ad:70,  unlock:{t:"race",id:"pineridge"}, desc:"Concrete high banks. Loudest half-mile on earth."},
 {id:"boardwalk",  n:"Boardwalk Mile",      surf:"mid",   geo:"oval",      mi:1.00, laps:30, fee:16,
  prize:[180,90,54,30,16,8],  fans:140, ad:90,  unlock:{t:"race",id:"thunderbowl"}, desc:"Flat one-mile by the sea. Momentum is king."},
 {id:"maplecity",  n:"Maple City Motorplex",surf:"mid",   geo:"quadoval",  mi:1.50, laps:32, fee:22,
  prize:[240,120,72,40,22,11],fans:180, ad:110, unlock:{t:"race",id:"boardwalk"}, desc:"1.5-mile quad-oval. The modern standard."},
 {id:"peachstate", n:"Peach State 400",     surf:"mid",   geo:"quadoval",  mi:1.54, laps:34, fee:26,
  prize:[280,140,84,47,26,13],fans:210, ad:130, unlock:{t:"garage",lv:2}, desc:"Worn asphalt. Tires go off a cliff."},
 {id:"granite",    n:"Granite Canyon",      surf:"short", geo:"eggoval",   mi:1.37, laps:30, fee:24,
  prize:[260,130,78,44,24,12],fans:200, ad:125, unlock:{t:"garage",lv:2}, desc:"Egg-shaped and unforgiving. Kiss the wall."},
 {id:"hogback",    n:"Hogback Road Course", surf:"road",  geo:"road",      mi:2.45, laps:16, fee:30,
  prize:[300,150,90,50,28,14],fans:230, ad:140, unlock:{t:"garage",lv:2}, desc:"Left AND right turns. Brakes matter here."},
 {id:"gateway",    n:"Gateway Groove",      surf:"mid",   geo:"eggoval",   mi:1.25, laps:34, fee:34,
  prize:[340,170,102,57,31,16],fans:260,ad:160, unlock:{t:"garage",lv:3}, desc:"Two very different ends. Set-up nightmare."},
 {id:"bigbeach",   n:"Big Beach 500",       surf:"ss",    geo:"trioval",   mi:2.50, laps:36, fee:40,
  prize:[400,200,120,67,37,19],fans:340,ad:190, unlock:{t:"garage",lv:3}, desc:"2.5-mile tri-oval. Draft or die."},
 {id:"yellowhammer",n:"Yellowhammer Super", surf:"ss",    geo:"trioval",   mi:2.66, laps:38, fee:44,
  prize:[440,220,132,74,41,20],fans:380,ad:210, unlock:{t:"race",id:"bigbeach"}, desc:"The biggest, fastest pack racing there is."},
 {id:"saltflats",  n:"Salt Flats Speedway", surf:"ss",    geo:"doval",     mi:2.00, laps:34, fee:38,
  prize:[380,190,114,64,35,18],fans:300,ad:180, unlock:{t:"race",id:"boardwalk"}, desc:"A wide-open D-shape. Wide-open throttle."},
 {id:"pocahontas", n:"Pocahontas Triangle", surf:"mid",   geo:"triangle",  mi:2.50, laps:26, fee:36,
  prize:[360,180,108,60,33,17],fans:280,ad:170, unlock:{t:"garage",lv:3}, desc:"Three corners, three personalities."},
 {id:"victorylane",n:"Victory Lane Classic",surf:"mid",   geo:"quadoval",  mi:1.50, laps:44, fee:50,
  prize:[520,260,156,87,48,24],fans:450,ad:250, unlock:{t:"race",id:"yellowhammer"}, desc:"The crown jewel. 600 miles of attrition."},
 {id:"thunderroad",n:"Thunder Road",        surf:"short", geo:"paperclip", mi:0.75, laps:34, fee:46,
  prize:[480,240,144,80,44,22],fans:400,ad:230, unlock:{t:"race",id:"clayton"}, desc:"Where the bootleggers started it all. Flat and mean."},
 {id:"lakeshore",  n:"Lakeshore Street Race",surf:"street",geo:"street",    mi:2.20, laps:20, fee:28,
  prize:[290,145,87,49,27,13],fans:240, ad:145, unlock:{t:"race",id:"hogback"}, desc:"City streets, concrete both sides. No room for a mistake."},
 {id:"harborloop", n:"Harbor Loop",         surf:"street",geo:"streettight",mi:1.60, laps:26, fee:42,
  prize:[420,210,126,70,38,19],fans:360, ad:200, unlock:{t:"race",id:"lakeshore"}, desc:"Second gear round a monument. Brakes cook, tempers too."},
 {id:"crestline",  n:"Crestline Park",      surf:"road",  geo:"roadlong",  mi:3.10, laps:14, fee:48,
  prize:[500,250,150,84,46,23],fans:420, ad:240, unlock:{t:"garage",lv:3}, desc:"A long opening sweeper and a hairpin that eats front tires."},
 {id:"bigbeachrc", n:"Big Beach Road Course",surf:"road", geo:"roadoval",  mi:3.56, laps:12, fee:54,
  prize:[560,280,168,94,52,26],fans:480, ad:270, unlock:{t:"race",id:"bigbeach"}, desc:"Down the banking, hard left into the infield. Two tracks in one."},
 {id:"kairodome",  n:"Retro Dome",          surf:"short", geo:"bowl",      mi:0.75, laps:44, fee:60,
  prize:[620,310,186,104,57,29],fans:520,ad:300, unlock:{t:"series",id:"cup"}, desc:"An indoor short track. Pure chaos."},
];

/* ---------- SERIES ---------- */
const SERIES = [
 {id:"rookie", n:"Rookie Cup",     tier:1, fee:30,  rivals:5,  str:[34,56],
  tracks:["pineridge","clayton","thunderbowl","boardwalk"],
  purse:[500,250,150,90,60,40],   fans:600,  req:{garage:1}},
 {id:"national",n:"National Series",tier:2, fee:80,  rivals:6,  str:[62,92],
  tracks:["boardwalk","maplecity","granite","peachstate","hogback","saltflats"],
  purse:[1000,500,300,180,120,80],fans:1400, req:{garage:2}},
 {id:"cup",    n:"Premier Cup",    tier:3, fee:160, rivals:7,  str:[100,142],
  tracks:["maplecity","gateway","bigbeach","hogback","pocahontas","yellowhammer","granite","victorylane"],
  purse:[2000,1000,600,360,240,160],fans:3000,req:{garage:3}, playoff:true},
];
const PTS = [40,35,34,33,32,31,30,29,28,27,26,25];

/* ---------- GARAGE LEVELS ---------- */
const GARAGES = [null,
 {n:"Backyard Garage", crew:2, cars:1, teams:1, cost:0,    req:null},
 {n:"Race Shop",       crew:4, cars:2, teams:2, cost:600,  req:"rookie"},
 {n:"Motorsports HQ",  crew:6, cars:3, teams:2, cost:1800, req:"national"}];

/* ---------- AURAS ---------- (GPS: blue < pink < silver < gold) */
const AURAS = {
 blue:  {n:"Blue",   mult:1.5, boost:1.14, dur:4.0, col:"#3aa0ff"},
 pink:  {n:"Pink",   mult:2.0, boost:1.20, dur:4.5, col:"#ff69b4"},
 silver:{n:"Silver", mult:2.5, boost:1.26, dur:5.5, col:"#c8d2e0"},
 gold:  {n:"Gold",   mult:3.0, boost:1.34, dur:7.0, col:"#ffd23f"},
};
const AURA_ORDER = ["blue","pink","silver","gold"];

/* ---------- RIVALS ---------- */
const RIVAL_TEAMS = ["Haybale Racing","Two-Lane Motorsports","Coyote Speed Co.","Ironhead Garage",
 "Blue Ridge Racers","Cactus Crown","Steel City Stockers","Gulf Coast Gears","Prairie Fire Racing",
 "Night Owl Racing","Copperhead Crew","Lone Star Livery","Dust Devil Racing","Piedmont Bros."];
const RIVAL_DRIVERS = ["Buck Diesel","Sally Slide","Tex Turner","Moose Malone","Reba Rev","Chip Chassis",
 "Duke Dragline","Patty Pushrod","Slim Slick","Ace Alternator","Jolene Jets","Big Earl","Cooter Camber",
 "Wanda Wideopen","Bubba Banks","Rico Radial"];

/* ---------- EVENTS (flavor) ---------- */
const EVENTS = [
 {t:"A local TV crew films the shop.", fx:{fans:60,ad:10}},
 {t:"A fan club opens in town!", fx:{fans:120}},
 {t:"The crew finds a setup secret in an old notebook.", fx:{rp:15}},
 {t:"A parts supplier sends free samples.", fx:{money:40}},
 {t:"Rain floods the shop. Cleanup costs money.", fx:{money:-60}},
 {t:"Your driver signs autographs at the mall.", fx:{fans:80,ad:8}},
 {t:"A magazine puts your car on the cover!", fx:{fans:200,ad:25}},
 {t:"The crew pulls an all-nighter and learns something.", fx:{rp:25}},
];
