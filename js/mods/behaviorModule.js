(function installNgonBehaviorModule(){
    if (typeof window !== 'undefined' && window.__ngonBehaviorInjectorInstalled) return;
    if (typeof window !== 'undefined') window.__ngonBehaviorInjectorInstalled = true;
    console.log("behavior module patch installed");


//main behavior module, where all behaviors are defined and helper functions are established.
// this file itself can be placed in the main js folder and be run through the html
// Configuration constants 
const behaviorConfig = {
    // Block gathering (dragging with springs)
    blockDetectionRange: 1000,
    maxBlockMassToGather: 8,
    blockSpringStiffness: 0.002,
    blockSpringDamping: 0.1,
    // multiplier used to bias how strongly mobs pull blocks (1.0 = default) [currently not working]
    gatherPullBias: 3,
    gatherRandomDropTime: 5,
    
    // Power-up gathering (dragging with springs)
    powerUpDetectionRange: 500,
    powerUpSpringStiffness: 0.003,
    powerUpSpringDamping: 0.15,
    
    // Flocking
    flockCohesionRange: 250, // adjustable grouping distance
    flockSeparationRange: 100, // adjustable minimum safe distance
    flockAlignmentRange: 250,
    flockCohesionStrength: 0.0002,
    flockSeparationStrength: 0.0008,
    flockAlignmentStrength: 0.0003,
    
    // Wander
    wanderChangeFreq: 1,
    wanderRadius: 400,
    wanderStrength: 0.0003,
    wanderPlayerBias: 0.3,
    // divisor used to normalize mob radius when scaling wander force
    wanderSizeDivisor: 20,
    // Hiding: how close the player must be to trigger hide when not actively seen
    hideTriggerProximity: 1000,
    
    // Play behavior
    playJumpFreq: 2,
    playJumpForce: 0.015,
    playSpinFreq: 3,
    playSpinTorque: 0.001,
    playDashFreq: 2,
    playDashForce: 0.008,
    /*playBobSpeed: 0.02,
    playBobAmplitude: 30,*/
    
    // Mob combat
    mobCombatRange: 300,
    mobCombatDamage: 0.02,
    mobCombatCooldown: 1,

    inspectCheckFreq: 1000,
    inspectRange: 500,
    inspectHoverDistance: 80,
    inspectHoverSpeed: 0.0002,
    inspectDuration: 300,
    inspectCircleRadius: 60,

    behaviorSwitchTime: 10, 
    behaviorSwitchVariation: 2,  

    mobVsMobRange: 600
};
   //helper functions

    function hasIntervalPassed(lastTime, interval) {
        if (lastTime === undefined) return true;
        const currentTime = performance.now() / 1000; // Convert to seconds
        return (currentTime - lastTime) >= interval;
    }

    function updateIntervalTimer(mobInstance, timerName) {
        mobInstance[timerName] = performance.now() / 1000;
    }
    
    function getTimeSince(lastTime) {
        if (lastTime === undefined) return Infinity;
        return (performance.now() / 1000) - lastTime;
    }

    function shouldHaltBehavior() {
        return this.seePlayer.yes === true;
    }

    //block gathering (doesnt work right now)
    function gatherBlocks() {
        if (this.shouldHaltBehavior()) {
            this.releaseBlock();
            return;
        }
        
        if (this.draggedBlock && this.draggedBlock.body) {
            const blockExists = body.includes(this.draggedBlock.body);
            if (!blockExists) {
                this.releaseBlock();
                return;
            }
            try {
                const blockBody = this.draggedBlock.body;
                const diff = Vector.sub(blockBody.position, this.position);
                const dist2 = Vector.magnitudeSquared(diff);
                const dist = Math.sqrt(dist2 || 0);
                const blockRadius = blockBody.circleRadius || 30;
                const desired = this.radius + blockRadius + 10;

                if (dist > desired + 2) {
                    const distanceFactor = Math.min(6, dist / Math.max(desired, 1));
                    const sizeFactor = ((this.radius && this.radius > 0) ? (this.radius / 20) : 1);
                    const strength = this.accelMag * this.mass * distanceFactor * 4.0 * sizeFactor * (behaviorConfig.gatherPullBias || 1);
                    const unit = Vector.normalise(diff);
                    const forceVec = Vector.mult(unit, strength);

                    Matter.Body.applyForce(this, this.position, forceVec)

                    if (typeof Matter !== 'undefined' && Matter.Body) {
                        try {
                            const applyScale = 0.0006;
                            const applyForce = { x: unit.x * strength * applyScale, y: unit.y * strength * applyScale };
                            Matter.Body.applyForce(blockBody, blockBody.position, applyForce);
                            if (this.position && this.body) {
                                Matter.Body.applyForce(this, this.position, { x: -applyForce.x * 0.6, y: -applyForce.y * 0.6 });
                            }
                        } catch (e) { }
                    }
                } else if (dist < desired - 2) {
                    const strength = this.accelMag * this.mass * 1.4;
                    const forceVec = Vector.mult(Vector.normalise(diff), -strength);
                    
                    Matter.Body.applyForce(this, this.position, forceVec)
                }
            } catch (e) { }
            return;
        }
        
        let closestBlock = null;
        let closestDist2 = behaviorConfig.blockDetectionRange ** 2;
        
        for (let i = 0; i < body.length; i++) {
            if (!body[i].isNotHoldable && 
                body[i].mass <= behaviorConfig.maxBlockMassToGather &&
                body[i].mass > 0.5) {
                
                const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, body[i].position));
                if (dist2 < closestDist2) {
                    closestDist2 = dist2;
                    closestBlock = body[i];
                }
            }
        }
        
        if (closestBlock) {
            const restLength = this.radius + (closestBlock.circleRadius || 30) + 10;
            
            // Create the constraint
            const constraint = Constraint.create({
                bodyA: this,
                bodyB: closestBlock,
                stiffness: behaviorConfig.blockSpringStiffness,
                damping: behaviorConfig.blockSpringDamping,
                length: restLength
            });
            
            // Add it to the world
            Composite.add(engine.world, constraint);
            
            
            this.draggedBlock = {
                body: closestBlock,
                constraint: constraint 
            };
            
            simulation.drawList.push({
                x: this.position.x,
                y: this.position.y,
                radius: this.radius * 1.2,
                color: "rgba(100,200,100,0.3)",
                time: 8
            });
        }
    }

    function releaseBlock() {
        if (this.draggedBlock && this.draggedBlock.constraint) {
            Composite.remove(engine.world, this.draggedBlock.constraint);
            this.draggedBlock = null;
        }
    }


    function playDead() {
        // If a global freeze is active, allow play-dead ONLY if it's already active
        if (this.shouldHaltBehavior()) return;

        const toPlayer = Vector.sub(player.position, this.position);
        const playerDist = Math.sqrt(Vector.magnitudeSquared(toPlayer) || 0);
        const threshold = behaviorConfig.hideTriggerProximity;

        // activate the behavior
        if (!this.isPlayingDead && playerDist <= threshold) {
            this.isPlayingDead = true;
        }

        // deactivate the behavior
        if (this.isPlayingDead && playerDist > threshold) {
            this.isPlayingDead = false;
            return; // let normal behaviors resume
        }

        
        if (!this.isPlayingDead) return;

        

        // add a gentle downwards force to simulate non-gravity mobs having gravity and passing out
        Matter.Body.applyForce(this, this.position, { x: 0, y: 0.02 * this.mass });

        
        if (Math.abs(this.velocity.y) < 0.02) {
            Matter.Body.setVelocity(this, { x: 0, y: 0 });
        }

        // Kill all steering and external forces
        //this.force.x = 0;
        //this.force.y = 0;

        //this.steerVector.x = 0;
        //this.steerVector.y = 0;

        // If you have friction/airResistance you may want to cancel it:
        // this.body.frictionAir = 0.3;  // optional
    }

    function drawDraggedBlock() {
        if (this.draggedBlock && this.draggedBlock.body) {
            // Draw spring line
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(this.draggedBlock.body.position.x, this.draggedBlock.body.position.y);
            ctx.strokeStyle = "rgba(100,200,100,0.4)";
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // power up gathering (wip)
    function gatherPowerUps() {
        if (this.shouldHaltBehavior()) {
            this.releasePowerUp();
            return;
        }
        
        if (this.draggedPowerUp && this.draggedPowerUp.body) {
            const powerUpExists = powerUp.includes(this.draggedPowerUp.body);
            if (!powerUpExists) {
                this.releasePowerUp();
            }
            return;
        }
        
        let closestPowerUp = null;
        let closestDist2 = behaviorConfig.powerUpDetectionRange ** 2;
        
        for (let i = 0; i < powerUp.length; i++) {
            const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position));
            if (dist2 < closestDist2) {
                closestDist2 = dist2;
                closestPowerUp = powerUp[i];
            }
        }
        
        if (closestPowerUp) {
            // Create the constraint
            const constraint = Constraint.create({
                bodyA: this,
                bodyB: closestPowerUp,
                stiffness: behaviorConfig.powerUpSpringStiffness,
                damping: behaviorConfig.powerUpSpringDamping,
                length: this.radius + (closestPowerUp.size || 20)
            });
            
            // Add it to the world
            Composite.add(engine.world, constraint);
            
            
            this.draggedPowerUp = {
                body: closestPowerUp,
                constraint: constraint
            };
            
            simulation.drawList.push({
                x: this.position.x,
                y: this.position.y,
                radius: this.radius * 1.2,
                color: "rgba(255,200,100,0.4)",
                time: 8
            });
        }
    }


    function releasePowerUp() {
        if (this.draggedPowerUp && this.draggedPowerUp.constraint) {
            Composite.remove(engine.world, this.draggedPowerUp.constraint);
            this.draggedPowerUp = null;
        }
    }


    function drawDraggedPowerUp() {
        if (this.draggedPowerUp && this.draggedPowerUp.body) {
            // Draw spring line
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(this.draggedPowerUp.body.position.x, this.draggedPowerUp.body.position.y);
            ctx.strokeStyle = "rgba(255,200,100,0.5)";
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }



    function hideFromPlayer() {
        if (!player || !player.position) return;

        const cycle = (typeof simulation !== "undefined" ? simulation.cycle : 0);
        // A* could be improved
        // A* system init
        this._aStarDebug = {
            enabled: true,
            cycle,
            expansions: [],
            neighbors: [],
            segments: [],
            resultPath: null,
            usedFallback: false,
            heatmapRadius: 20,
            draw: true     //draw all debug lines and points
        };
        //const DEBUG = (msg) => { /* optional console.log(msg) */ };
        // ============================================================

        const toPlayerVec = Vector.sub(player.position, this.position);
        const playerDist = Math.sqrt(Vector.magnitudeSquared(toPlayerVec) || 0);
        const proximityTrigger = behaviorConfig.hideTriggerProximity;
        const seenRecently = this.seePlayer && this.seePlayer.recall;

        // Draw red proximity circle
        /*try {
            const s = Math.max(8, this.radius * 1.8);
            if (typeof simulation !== 'undefined' && simulation.drawList) {
                simulation.drawList.push({ x: this.position.x, y: this.position.y, radius: s * 1.05, color: "rgba(255,0,0,0.9)", time: 6 });
                simulation.drawList.push({ x: this.position.x, y: this.position.y, radius: Math.max(2, this.radius * 0.35), color: "rgba(255,0,0,0.6)", time: 6 });
            }
        } catch (e) { }*/

        if (!seenRecently && playerDist > proximityTrigger) return;

        try {
            if (simulation && simulation.draw && typeof simulation.draw.lineOfSightPrecalculation === 'function') {
                simulation.draw.lineOfSightPrecalculation();
            }
        } catch (e) { }

        function pointInPoly(pt, vs) {
            if (!vs || vs.length === 0) return false;
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                const xi = vs[i].x, yi = vs[i].y;
                const xj = vs[j].x, yj = vs[j].y;
                const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        let playerLoS = null;
        try {
            if (simulation && simulation.sight && typeof simulation.sight.circleLoS === 'function') {
                playerLoS = simulation.sight.circleLoS(player.position, Math.max(800, proximityTrigger * 4));
            }
        } catch (e) { playerLoS = null; }

        const toPlayer = Vector.sub(player.position, this.position);
        const len2 = Vector.magnitudeSquared(toPlayer);
        if (len2 === 0) return;

        let best = null;
        let bestScore = Infinity;

        if (playerLoS && playerLoS.length > 0) {
            for (let i = 0; i < map.length; i++) {
                const m = map[i];
                if (!m || !m.position) continue;
                let visible = false;
                if (m.vertices && m.vertices.length) {
                    for (let v = 0; v < m.vertices.length; v++) {
                        if (pointInPoly(m.vertices[v], playerLoS)) { visible = true; break; }
                    }
                } else {
                    visible = pointInPoly(m.position, playerLoS);
                }
                if (visible) continue;

                const d2 = Vector.magnitudeSquared(Vector.sub(m.position, this.position));
                if (d2 < bestScore) {
                    bestScore = d2;
                    best = m;
                }
            }
        }

        if (!best) {
            let fallbackDist2 = Infinity;
            for (let i = 0; i < map.length; i++) {
                const m = map[i];
                if (!m || !m.position) continue;
                const d2 = Vector.magnitudeSquared(Vector.sub(m.position, this.position));
                if (d2 < fallbackDist2) {
                    fallbackDist2 = d2;
                    best = m;
                }
            }
        }

        if (!best) return;

        const mapCenter = best.position;
        let away = Vector.sub(mapCenter, player.position);
        const awayLen2 = Vector.magnitudeSquared(away);
        if (awayLen2 === 0) {
            away = Vector.sub(mapCenter, this.position);
        }
        away = Vector.normalise(away);

        const mapRadius = best.circleRadius || (best.bounds ? Math.max(best.bounds.max.x - best.bounds.min.x, best.bounds.max.y - best.bounds.min.y) / 2 : 50);
        const hidePos = Vector.add(mapCenter, Vector.mult(away, mapRadius + this.radius + 8));

        // a* pathfinding
        const SEG_CACHE_TTL = 120;
        this._segmentCache = this._segmentCache || new Map();

        const roundVec = (v) => ({ x: Math.round(v.x*10)/10, y: Math.round(v.y*10)/10 });

        const raycastMap = (a, b) => {
            if (!Matter || !Matter.Query || !map || !map.length) return { blocked:false, hits:[], cycle };
            const aR = roundVec(a), bR = roundVec(b);
            const key = `${aR.x},${aR.y}|${bR.x},${bR.y}`;
            const cached = this._segmentCache.get(key);
            if (cached && cycle - cached.cycle < SEG_CACHE_TTL) return cached;

            let hits = [];
            try { hits = Matter.Query.ray(map, a, b) || []; } catch (e) { hits = []; }

            const out = { blocked: hits.length>0, hits, cycle };
            this._segmentCache.set(key,out);

            if(this._aStarDebug.enabled && this._aStarDebug.draw && simulation.drawList){
                simulation.drawList.push({ x:a.x,y:a.y,radius:1,color:out.blocked?"rgba(255,0,0,0.5)":"rgba(0,255,0,0.25)",time:2 });
                simulation.drawList.push({ x:b.x,y:b.y,radius:1,color:out.blocked?"rgba(255,0,0,0.5)":"rgba(0,255,0,0.25)",time:2 });
            }

            if(this._aStarDebug.enabled) this._aStarDebug.segments.push({ a:{...a},b:{...b},blocked:out.blocked });

            return out;
        };

        const computePathForce = (mob) => {
            if (!mob._navPath || mob._navPath.length < 2) return null;

            // Next waypoint along the path
            const nextIndex = Math.min(mob._navIndex || 1, mob._navPath.length - 1);
            const waypoint = mob._navPath[nextIndex];

            // Direction vector toward waypoint
            const toWaypoint = Vector.sub(waypoint, mob.position);
            const distance = Math.sqrt(Vector.magnitudeSquared(toWaypoint) || 0);
            if (distance < 0.5) return null; // already at waypoint

            const dir = Vector.normalise(toWaypoint);

            // Compute magnitude based on distance and mob properties
            const forceMagnitude = Math.min(mob.accelMag * mob.mass * 0.3 * distance, mob.accelMag * mob.mass * 3);

            return Vector.mult(dir, forceMagnitude);
        };

        const segmentBlocked = (a,b) => raycastMap(a,b).blocked;

        const approxVertices = (blk) => {
            if (blk.vertices && blk.vertices.length) return blk.vertices;
            if (blk.bounds) {
                const {min,max} = blk.bounds;
                return [{x:min.x,y:min.y},{x:max.x,y:min.y},{x:max.x,y:max.y},{x:min.x,y:max.y}];
            }
            if (blk.position && blk.circleRadius){
                const {x,y}=blk.position, r=blk.circleRadius;
                return [{x:x+r,y:y},{x:x,y:y+r},{x:x-r,y:y},{x:x,y:y-r}];
            }
            return [];
        };

        const buildCandidates = (blockers) => {
            const candidates=[]; const offsetDist=Math.max(12,this.radius+8); const MAX_CANDIDATES=14;
            for(let i=0;i<blockers.length&&candidates.length<MAX_CANDIDATES;i++){
                const blk=blockers[i]; const verts=approxVertices(blk); if(!verts.length) continue;
                const sampleCount=Math.min(3,verts.length);
                const step=Math.max(1,Math.floor(verts.length/sampleCount));
                const center=blk.position||verts[0];
                for(let v=0;v<verts.length&&candidates.length<MAX_CANDIDATES;v+=step){
                    const vert=verts[v];
                    let dir=Vector.sub(vert,center);
                    const mag2=Vector.magnitudeSquared(dir);
                    dir=mag2===0?{x:1,y:0}:Vector.normalise(dir);
                    candidates.push({ x:vert.x+dir.x*offsetDist, y:vert.y+dir.y*offsetDist });
                }
            }
            return candidates;
        };

        const reconstructPath = (cameFrom,nodes,current)=>{
            const path=[];
            while(current!==-1){ path.push(nodes[current]); current=cameFrom[current]; }
            return path.reverse();
        };

        const runAStar=(start,goal,extras)=>{
            const nodes=[start].concat(extras,[goal]); const goalIdx=nodes.length-1;
            const g=new Array(nodes.length).fill(Infinity);
            const f=new Array(nodes.length).fill(Infinity);
            const cameFrom=new Array(nodes.length).fill(-1);
            const open=[]; const openSet=new Set(); const closed=new Array(nodes.length).fill(false);
            const heuristic=(i)=>Math.sqrt(Vector.magnitudeSquared(Vector.sub(nodes[goalIdx],nodes[i]))||0);
            g[0]=0; f[0]=heuristic(0); open.push(0); openSet.add(0);
            while(open.length){
                open.sort((a,b)=>f[a]-f[b]); const current=open.shift(); openSet.delete(current);
                if(this._aStarDebug.enabled){
                    this._aStarDebug.expansions.push({index:current,position:nodes[current],g:g[current],f:f[current]});
                    if(simulation.drawList)this._aStarDebug.draw && simulation.drawList.push({x:nodes[current].x,y:nodes[current].y,radius:this._aStarDebug.heatmapRadius,color:"rgba(255,150,0,0.07)",time:6});
                }
                if(current===goalIdx) return reconstructPath(cameFrom,nodes,current);
                closed[current]=true;
                for(let neighbor=0;neighbor<nodes.length;neighbor++){
                    if(neighbor===current||closed[neighbor])continue;
                    const blocked=segmentBlocked(nodes[current],nodes[neighbor]);
                    if(this._aStarDebug.enabled){
                        this._aStarDebug.neighbors.push({from:current,to:neighbor,blocked});
                        if(simulation.drawList)this._aStarDebug.draw && simulation.drawList.push({x:nodes[neighbor].x,y:nodes[neighbor].y,radius:1,color:blocked?"rgba(255,0,0,0.2)":"rgba(0,255,0,0.15)",time:2});
                    }
                    if(blocked)continue;
                    const dist=Math.sqrt(Vector.magnitudeSquared(Vector.sub(nodes[neighbor],nodes[current]))||0);
                    const tentativeG=g[current]+dist;
                    if(tentativeG>=g[neighbor]-1e-4) continue;
                    cameFrom[neighbor]=current;
                    g[neighbor]=tentativeG;
                    f[neighbor]=tentativeG+heuristic(neighbor);
                    if(!openSet.has(neighbor)){ open.push(neighbor); openSet.add(neighbor); }
                }
            }
            return null;
        };
        const collectBlockers = (start, goal, maxBlockers = 6) => {
            const primaryHits = raycastMap(start, goal).hits;
            if (!primaryHits.length) return [];

            const blockers = [];
            for (let i = 0; i < primaryHits.length && blockers.length < maxBlockers; i++) {
                const hit = primaryHits[i];
                // Matter bodies or objects hit
                const bodyHit = hit.body || hit.object || hit;
                if (bodyHit && blockers.indexOf(bodyHit) === -1) {
                    blockers.push(bodyHit);
                }
            }
            return blockers;
        };

        const ensureNavPath=()=>{
            if(!segmentBlocked(this.position,hidePos)){ this._navPath=null; this._navPathTargetKey=null; return; }
            const targetKey=`${Math.round(hidePos.x)},${Math.round(hidePos.y)}`;
            const blockers=collectBlockers(this.position,hidePos);
            const candidates=buildCandidates(blockers);
            const path=runAStar({x:this.position.x,y:this.position.y},hidePos,candidates);
            if(this._aStarDebug.enabled)this._aStarDebug.resultPath=path?[...path]:null;
            if(path&&path.length>1){ this._navPath=path; this._navIndex=1; this._navPathTargetKey=targetKey; return; }
            this._aStarDebug.usedFallback=true;
            const awayDir=Vector.normalise(Vector.sub(hidePos,this.position)||{x:1,y:0});
            const perp={x:-awayDir.y,y:awayDir.x};
            const alt1=Vector.add(hidePos,Vector.mult(perp,this.radius+16));
            const alt2=Vector.add(hidePos,Vector.mult(perp,-(this.radius+16)));
            if(!segmentBlocked(this.position,alt1)&&!segmentBlocked(alt1,hidePos)){ this._navPath=[{...this.position},alt1,hidePos]; this._navIndex=1; this._navPathTargetKey=targetKey; }
            else if(!segmentBlocked(this.position,alt2)&&!segmentBlocked(alt2,hidePos)){ this._navPath=[{...this.position},alt2,hidePos]; this._navIndex=1; this._navPathTargetKey=targetKey; }
            else { this._navPath=null; this._navIndex=0; this._navPathTargetKey=null; }
        };

        ensureNavPath();

        //  movement along nav path / hidePos 
        if(this._navPath && this._navPath.length>0){
            this._navIndex=this._navIndex||1;
            if(this._navIndex>=this._navPath.length) this._navIndex=this._navPath.length-1;
            const waypoint=this._navPath[this._navIndex];
            const toWaypoint=Vector.sub(waypoint,this.position);
            const wpDist=Math.sqrt(Vector.magnitudeSquared(toWaypoint)||0);
            if(wpDist<Math.max(6,this.radius)){ this._navIndex++; if(this._navIndex>=this._navPath.length){ this._navPath=null; this._navPathTargetKey=null; } }
            else{
                const force = computePathForce(this);
                if (force) {
                    Matter.Body.applyForce(this, this.position, force);
                    return;
                }
                return;
            }
        }

        const desired=Vector.sub(hidePos,this.position);
        const dist=Math.sqrt(Vector.magnitudeSquared(desired)||0);
        if(dist>8){
            const distFactor=Math.min(4,Math.max(1.0,dist/60));
            const baseMag=this.accelMag*this.mass*1.8;
            const moveForce=Vector.mult(Vector.normalise(desired),baseMag*distFactor);
            Matter.Body.applyForce(this,this.position,moveForce);
        } else if(simulation.cycle%30===0){
            Matter.Body.applyForce(this,this.position,{ x: (Math.random()-0.5)*0.02*this.mass, y: (Math.random()-0.5)*0.02*this.mass });
        }

        if(simulation.cycle%20===0){
            simulation.drawList.push({ x:hidePos.x,y:hidePos.y,radius:Math.max(6,this.radius*0.6),color:"rgba(50,200,50,0.35)",time:8 });
        }

        try{
            const los=Matter.Query.ray(map,this.position,player.position);
            this._isHidden=(los&&los.length>0);
        }catch(e){ this._isHidden=false; }
    }


    // flocking behavior

    function flock() {
        const cycle = (typeof simulation !== 'undefined' && typeof simulation.cycle === 'number') ? simulation.cycle : 0;
        
        if (cycle % 30 === 0) {
            if (this.shouldHaltBehavior()) return;
        }
    
        
        let cohesionForce = { x: 0, y: 0 };
        let separationForce = { x: 0, y: 0 };
        let alignmentForce = { x: 0, y: 0 };
        
        let cohesionCount = 0;
        let separationCount = 0;
        let alignmentCount = 0;
        
        // Check all other mobs
        for (let i = 0; i < mob.length; i++) {
            if (mob[i] === this || !mob[i].alive) continue;
            
            const diff = Vector.sub(mob[i].position, this.position);
            const dist2 = Vector.magnitudeSquared(diff);
            const dist = Math.sqrt(dist2);
            
            // Cohesion: move toward average position of nearby mobs
            if (dist < behaviorConfig.flockCohesionRange) {
                cohesionForce.x += mob[i].position.x;
                cohesionForce.y += mob[i].position.y;
                cohesionCount++;
            }
            
            // Separation: avoid getting too close
            if (dist < behaviorConfig.flockSeparationRange && dist > 0) {
                const repel = Vector.mult(Vector.normalise(diff), -1 / dist);
                separationForce.x += repel.x;
                separationForce.y += repel.y;
                separationCount++;
            }
            
            // Alignment: match velocity with nearby mobs
            if (dist < behaviorConfig.flockAlignmentRange) {
                alignmentForce.x += mob[i].velocity.x;
                alignmentForce.y += mob[i].velocity.y;
                alignmentCount++;
            }
        }
        
        // Apply cohesion
        if (cohesionCount > 0) {
            cohesionForce.x = cohesionForce.x / cohesionCount - this.position.x;
            cohesionForce.y = cohesionForce.y / cohesionCount - this.position.y;
            const cohesion = Vector.mult(
                Vector.normalise(cohesionForce),
                this.mass * behaviorConfig.flockCohesionStrength
            );
            Matter.Body.applyForce(this, this.position, cohesion);
        }
        
        // Apply separation
        if (separationCount > 0) {
            const separation = Vector.mult(
                Vector.normalise(separationForce),
                this.mass * behaviorConfig.flockSeparationStrength
            );
            Matter.Body.applyForce(this, this.position, separation);
        }
        
        // Apply alignment
        if (alignmentCount > 0) {
            alignmentForce.x /= alignmentCount;
            alignmentForce.y /= alignmentCount;
            const alignment = Vector.mult(
                Vector.normalise(Vector.sub(alignmentForce, this.velocity)),
                this.mass * behaviorConfig.flockAlignmentStrength
            );
            Matter.Body.applyForce(this, this.position, alignment);
        }
        
        // Visual indicator when flocking
        if (cohesionCount > 0 && simulation.cycle % 30 === 0) {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, behaviorConfig.flockCohesionRange, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(100,100,255,0.08)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // wandering behavior

    function wander() {
        if (this.shouldHaltBehavior()) return;
        
        if (this.wanderAngle === undefined) {
            this.wanderAngle = Math.random() * Math.PI * 2;
            this.wanderLastChange = performance.now() / 1000;
        }
        
        // Change direction based on time, not frames
        if (hasIntervalPassed(this.wanderLastChange, behaviorConfig.wanderChangeFreq)) {
            this.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.5;
            
            if (Math.random() < behaviorConfig.wanderPlayerBias) {
                const toPlayer = Vector.sub(player.position, this.position);
                const playerAngle = Math.atan2(toPlayer.y, toPlayer.x);
                this.wanderAngle = this.wanderAngle * 0.7 + playerAngle * 0.3;
            }
            
            updateIntervalTimer(this, 'wanderLastChange');
        }
        
        const wanderTarget = {
            x: this.position.x + Math.cos(this.wanderAngle) * behaviorConfig.wanderRadius,
            y: this.position.y + Math.sin(this.wanderAngle) * behaviorConfig.wanderRadius
        };
        
        const sizeFactor = (this.radius && this.radius > 0) ? (this.radius / behaviorConfig.wanderSizeDivisor) : 1;
        const baseForce = Vector.mult(
            Vector.normalise(Vector.sub(wanderTarget, this.position)),
            this.mass * behaviorConfig.wanderStrength
        );
        const force = Vector.mult(baseForce, sizeFactor);

        Matter.Body.applyForce(this,this.position, force);
        
        // Draw occasionally based on time
        if (hasIntervalPassed(this.wanderLastDraw, behaviorConfig.wanderDrawInterval)) {
            ctx.beginPath();
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(wanderTarget.x, wanderTarget.y);
            ctx.strokeStyle = "rgba(150,150,150,0.15)";
            ctx.lineWidth = 1;
            ctx.stroke();
            updateIntervalTimer(this, 'wanderLastDraw');
        }
    }

    // playing behavior (so cute)

    function play() {
        if (this.shouldHaltBehavior()) return;
        const gravityForce = { x: 0, y: 0.001 * (this.mass || 1) }; // Scaling by mass is good practice
        Matter.Body.applyForce(this, this.position, gravityForce);
        // Random jumping based on time
        if (hasIntervalPassed(this.playLastJump, behaviorConfig.playJumpFreq) && Math.random() > 0.5) {
            Matter.Body.applyForce(this, this.position, { x: 0, y: -this.mass * behaviorConfig.playJumpForce * 0.5 });
            
            simulation.drawList.push({
                x: this.position.x,
                y: this.position.y + this.radius,
                radius: this.radius * 0.5,
                color: "rgba(255,255,100,0.3)",
                time: 8
            });
            
            updateIntervalTimer(this, 'playLastJump');
        }
        
        // Random spinning based on time
        if (hasIntervalPassed(this.playLastSpin, behaviorConfig.playSpinFreq) && Math.random() > 0.5) {
            this.torque += this.inertia * behaviorConfig.playSpinTorque * (Math.random() > 0.5 ? 1 : -1);
            updateIntervalTimer(this, 'playLastSpin');
        }
        
        // Random direction changes based on time
        if (hasIntervalPassed(this.playLastDash, behaviorConfig.playDashFreq) && Math.random() > 0.7) {
            const randomAngle = Math.random() * Math.PI * 2;
            const force = Vector.mult(
                { x: Math.cos(randomAngle), y: Math.sin(randomAngle) },
                this.mass * this.accelMag * 0.4
            );
            Matter.Body.applyForce(this, this.position, {x: force.x, y: force.y});
            updateIntervalTimer(this, 'playLastDash');
        }
    }
    //old function, new function is farther up
    /*function play() {
        if (this.shouldHaltBehavior()) return;
        
        // Initialize bob offset for smooth up/down motion
        if (this.playBobOffset === undefined) {
            this.playBobOffset = Math.random() * Math.PI * 2;
        }
        
        // Gentle bobbing motion (floating up and down)
        const bobTarget = this.spawnPos.y + Math.sin(simulation.cycle * behaviorConfig.playBobSpeed + this.playBobOffset) * behaviorConfig.playBobAmplitude;
        const bobDiff = bobTarget - this.position.y;
        this.force.y += this.mass * bobDiff * 0.00003;
        
        
        
        // Random spinning
        if (!(simulation.cycle % behaviorConfig.playSpinFreq) && Math.random() > 0.5) {
            this.torque += this.inertia * behaviorConfig.playSpinTorque * (Math.random() > 0.5 ? 1 : -1);
        }
        
        // Occasional quick dash movements
        if (!(simulation.cycle % behaviorConfig.playDashFreq) && Math.random() > 0.7) {
            const randomAngle = Math.random() * Math.PI * 2;
            const dashForce = Vector.mult(
                { x: Math.cos(randomAngle), y: Math.sin(randomAngle) },
                this.mass * behaviorConfig.playDashForce
            );
            this.force.x += dashForce.x;
            this.force.y += dashForce.y;
            
            // Dash trail visual
            for (let i = 0; i < 3; i++) {
                simulation.drawList.push({
                    x: this.position.x - Math.cos(randomAngle) * i * 15,
                    y: this.position.y - Math.sin(randomAngle) * i * 15,
                    radius: this.radius * (0.5 - i * 0.1),
                    color: `rgba(255,255,100,${0.4 - i * 0.1})`,
                    time: 8 + i * 2
                });
            }
        }
        
    }*/
    // also wip
    function inspect() {
        if (this.shouldHaltBehavior()) {
            this.inspectTarget = null;
            this.inspectStartTime = null;
            return;
        }
        
        // Check if currently inspecting something
        if (this.inspectTarget) {
            // Check if target still exists
            let targetExists = false;
            if (this.inspectTarget.type === 'block') {
                targetExists = body.includes(this.inspectTarget.object);
            } else if (this.inspectTarget.type === 'powerup') {
                targetExists = powerUp.includes(this.inspectTarget.object);
            }
            
            if (!targetExists || (simulation.cycle - this.inspectStartTime) > behaviorConfig.inspectDuration) {
                // Target gone or inspection time over
                this.inspectTarget = null;
                this.inspectStartTime = null;
                return;
            }
            
            // Hover around the target in a circle
            const targetPos = this.inspectTarget.object.position;
            const toTarget = Vector.sub(targetPos, this.position);
            const dist = Vector.magnitude(toTarget);
            const desiredDist = behaviorConfig.inspectHoverDistance;
            
            // Calculate tangent for circling
            const angle = Math.atan2(toTarget.y, toTarget.x);
            const tangentAngle = angle + Math.PI / 2;
            
            // Mix radial and tangential forces
            let force = { x: 0, y: 0 };
            
            if (dist > desiredDist + 20) {
                // Too far, move inward
                const inward = Vector.normalise(toTarget);
                Matter.Body.applyForce(this, this.position, {x: inward.x * this.mass * behaviorConfig.inspectHoverSpeed * 2, y: inward.y * this.mass * behaviorConfig.inspectHoverSpeed * 2});
            } else if (dist < desiredDist - 20) {
                // Too close, move outward
                const outward = Vector.normalise(toTarget);
                Matter.Body.applyForce(this, this.position, {x: -outward.x * this.mass * behaviorConfig.inspectHoverSpeed * 2, y: -outward.y * this.mass * behaviorConfig.inspectHoverSpeed * 2});
            }
            
            // Add circular motion
            force.x += Math.cos(tangentAngle) * this.mass * behaviorConfig.inspectHoverSpeed * 3;
            force.y += Math.sin(tangentAngle) * this.mass * behaviorConfig.inspectHoverSpeed * 3;
            
            Matter.Body.applyForce(this, this.position, {x: force.x, y: force.y});
            
            // Visual: draw line to inspected object
            if (simulation.cycle % 15 === 0) {
                ctx.beginPath();
                ctx.arc(targetPos.x, targetPos.y, behaviorConfig.inspectHoverDistance, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255,200,0,0.15)";
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(this.position.x, this.position.y);
                ctx.lineTo(targetPos.x, targetPos.y);
                ctx.strokeStyle = "rgba(255,200,0,0.3)";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            return;
        }
        
        // Look for something to inspect
        if (!(simulation.cycle % behaviorConfig.inspectCheckFreq)) {
            const range2 = behaviorConfig.inspectRange ** 2;
            let candidates = [];
            
            // Check for interesting blocks
            for (let i = 0; i < body.length; i++) {
                if (body[i].isNotHoldable) continue;
                const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, body[i].position));
                if (dist2 < range2) {
                    candidates.push({ type: 'block', object: body[i], dist2: dist2 });
                }
            }
            
            // Check for power-ups
            for (let i = 0; i < powerUp.length; i++) {
                const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position));
                if (dist2 < range2) {
                    candidates.push({ type: 'powerup', object: powerUp[i], dist2: dist2 });
                }
            }
            
            // Pick a random candidate
            if (candidates.length > 0) {
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                this.inspectTarget = chosen;
                this.inspectStartTime = simulation.cycle;
                
                // Visual indicator of interest
                simulation.drawList.push({
                    x: this.position.x,
                    y: this.position.y - this.radius - 10,
                    radius: 20,
                    color: "rgba(255,200,0,0.6)",
                    time: 15
                });
            }
        }
    }


    // mob combat for aggressive mobs
    function defaultMobCombat() {
        if (!this.combatTarget || !this.combatTarget.alive) {
            return;
        }
        
        // Initialize cooldown and role if not exists
        if (this.mobCombatLastAttack === undefined) {
            this.mobCombatLastAttack = performance.now() / 1000;
        }
        
        const currentTime = performance.now() / 1000;
        
        // Initialize role and role switch timer
        if (this.mobCombatRole === undefined || this.mobCombatRoleStartTime === undefined) {
            // Randomly assign initial roles
            const thisIndex = mob.indexOf(this);
            const targetIndex = mob.indexOf(this.combatTarget);
            
            if (thisIndex < targetIndex) {
                this.mobCombatRole = 'chaser';
            } else {
                this.mobCombatRole = 'fleer';
            }
            
            this.mobCombatRoleStartTime = currentTime;
        }
        
        // Switch roles every 5 seconds
        const roleSwithInterval = 5; // seconds
        if (currentTime - this.mobCombatRoleStartTime > roleSwithInterval) {
            // Switch role
            this.mobCombatRole = (this.mobCombatRole === 'chaser') ? 'fleer' : 'chaser';
            this.mobCombatRoleStartTime = currentTime;
            
            // Visual indicator of role switch
            /*simulation.drawList.push({
                x: this.position.x,
                y: this.position.y,
                radius: this.radius * 1.5,
                color: this.mobCombatRole === 'chaser' ? "rgba(255,100,0,0.5)" : "rgba(100,200,255,0.5)",
                time: 15
            });*/
        }
        
        const target = this.combatTarget;
        const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, target.position));
        const dist = Math.sqrt(dist2);
        
        // Attack range check (only chasers attack)
        if (this.mobCombatRole === 'chaser' && dist < this.radius + target.radius + 20) {
            const timeSinceLastAttack = currentTime - this.mobCombatLastAttack;
            
            if (timeSinceLastAttack > (behaviorConfig.mobCombatCooldown || 1)) {
                
                const damage = behaviorConfig.mobCombatDamage || 0.02;
                target.damage(damage);
                this.mobCombatLastAttack = currentTime;
                
                // Visual effect: red line
                ctx.beginPath();
                ctx.moveTo(this.position.x, this.position.y);
                ctx.lineTo(target.position.x, target.position.y);
                ctx.strokeStyle = "rgba(255,0,0,0.5)";
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Visual effect: red circle at impact
                simulation.drawList.push({
                    x: target.position.x,
                    y: target.position.y,
                    radius: target.radius * 0.8,
                    color: "rgba(255,0,0,0.3)",
                    time: 6
                });
            }
        }
        
        // Movement behavior based on role
        if (this.mobCombatRole === 'chaser') {
            // Chase the target
            const force = Vector.mult(
                Vector.normalise(Vector.sub(target.position, this.position)),
                (this.accelMag || 0.001) * this.mass * 0.9
            );
            this.force.x += force.x;
            this.force.y += force.y;
            
            // Visual indicator: draw pursuit line occasionally
            if (Math.random() < 0.05) {
                ctx.beginPath();
                ctx.moveTo(this.position.x, this.position.y);
                ctx.lineTo(target.position.x, target.position.y);
                ctx.strokeStyle = "rgba(255,100,0,0.15)";
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 10]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        } else if (this.mobCombatRole === 'fleer') {
            // Flee from the target
            const force = Vector.mult(
                Vector.normalise(Vector.sub(this.position, target.position)),
                (this.accelMag || 0.001) * this.mass * 1.1 // Slightly faster when fleeing
            );
            this.force.x += force.x;
            this.force.y += force.y;
            
            // Visual indicator: draw fear indicator occasionally
            if (Math.random() < 0.05) {
                simulation.drawList.push({
                    x: this.position.x,
                    y: this.position.y - this.radius - 10,
                    radius: 10,
                    color: "rgba(255,255,0,0.4)",
                    time: 3
                });
            }
        }
    }
    


    function fightOtherMobs() {
        if (this.shouldHaltBehavior()) return;
        
        // If mob has custom combat methods, use those
        if (this.canFight && typeof this.findMobTarget === 'function') {
            // Find/update target (finds new target or keeps existing if in range)
            this.findMobTarget();
            
            // If we have a target, enter combat mode
            if (this.combatTarget && this.combatTarget.alive) {
                this.combatMode = true;
                
                if (typeof this.mobCombatBehavior === 'function') {
                    this.mobCombatBehavior();
                    return;
                } else if (typeof this.defaultMobCombat === 'function') {
                    this.defaultMobCombat();
                    return;
                }
            } else {
                this.combatMode = false;
                this.combatTarget = null;
                return;
            }
        }
        
        // DEFAULT COMBAT: For mobs without custom combat methods
        // Find nearest mob to fight
        if (!this.combatTarget || !this.combatTarget.alive || !mob.includes(this.combatTarget)) {
            this.combatTarget = null;
            
            let closestMob = null;
            let closestDist2 = (behaviorConfig.mobVsMobRange || 600) ** 2;
            
            for (let i = 0; i < mob.length; i++) {
                if (mob[i] === this || !mob[i].alive) continue;
                
                const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position));
                if (dist2 < closestDist2) {
                    closestDist2 = dist2;
                    closestMob = mob[i];
                }
            }
            
            this.combatTarget = closestMob;
        }
        
        // If we have a target, use default combat
        if (this.combatTarget && this.combatTarget.alive) {
            this.combatMode = true;
            if (typeof this.defaultMobCombat === 'function') {
                this.defaultMobCombat();
            }
        } else {
            this.combatMode = false;
        }
    }

    // cleaning up everything on death

    function cleanupBehaviorsOnDeath() {
        // Release any dragged objects
        this.releaseBlock();
        this.releasePowerUp();
    }
    
    function runActiveBehaviors() {
        // 1. Safety Check: Halt if player is seen (or other halt conditions)
        if (this.shouldHaltBehavior && this.shouldHaltBehavior()) {
            if (this.draggedBlock && this.releaseBlock) this.releaseBlock();
            if (this.draggedPowerUp && this.releasePowerUp) this.releasePowerUp();
            return;
        }

        // checking there are behaviors to run
        if (!this.activeBehaviors || this.activeBehaviors.length === 0) return;

        // no switching between behaviors when only one behavior is defined
        if (this.activeBehaviors.length === 1) {
            const behaviorName = this.activeBehaviors[0];
            if (typeof this[behaviorName] === 'function') {
                this[behaviorName]();
            }
            return;
        }

        // running behaviors only when the mob spawns and resets.
        // We define 'currentSwitchDuration' here so it is fixed, not calculated every frame
        if (this.currentBehaviorIndex === undefined || this.behaviorSwitchTime === undefined || this.currentSwitchDuration === undefined) {
            this.currentBehaviorIndex = Math.floor(Math.random() * this.activeBehaviors.length);
            this.behaviorSwitchTime = performance.now() / 1000; 
            
            this.currentSwitchDuration = behaviorConfig.behaviorSwitchTime + 
                (Math.random() - 0.5) * 2 * behaviorConfig.behaviorSwitchVariation;
        }

        // time
        // We use the stored 'currentSwitchDuration' which doesn't change frame-to-frame
        const currentTime = performance.now() / 1000;
        const timeSinceSwitch = currentTime - this.behaviorSwitchTime;

        // switching between behaviors 
        if (timeSinceSwitch >= this.currentSwitchDuration) {
            const currentBehavior = this.activeBehaviors[this.currentBehaviorIndex];

          
            if (currentBehavior === 'gatherBlocks' && this.releaseBlock) {
                this.releaseBlock();
            }
            if (currentBehavior === 'gatherPowerUps' && this.releasePowerUp) {
                this.releasePowerUp();
            }

           
            let newIndex = this.currentBehaviorIndex;
            // Try 10 times to find a random different one. 
            // If unlucky, just stay on current to prevent infinite loops (performance safety)
            for (let i = 0; i < 10; i++) {
                let candidate = Math.floor(Math.random() * this.activeBehaviors.length);
                if (candidate !== this.currentBehaviorIndex) {
                    newIndex = candidate;
                    break;
                }
            }
            this.currentBehaviorIndex = newIndex;

            // resetting timer
            this.behaviorSwitchTime = currentTime;
            
            // calculating duration of this behavior
            this.currentSwitchDuration = behaviorConfig.behaviorSwitchTime + 
                (Math.random() - 0.5) * 2 * behaviorConfig.behaviorSwitchVariation;
        }

        // 7. Execute Current Behavior
        const behaviorName = this.activeBehaviors[this.currentBehaviorIndex];
        if (typeof this[behaviorName] === 'function') {
            this[behaviorName]();
        }

        // Debug/Tracking (optional)
        try {
            this.lastBehaviorsCycle = simulation.cycle;
        } catch (e) { }
    }

    

    function drawDraggedObjects() {
        // Call this in mobs.draw() or after drawing the mob
        this.drawDraggedBlock();
        this.drawDraggedPowerUp();
    }
    

    function addBehaviorsToMob(mobInstance, behaviorsArray, customDoFunction) {
        // Add core methods
        mobInstance.shouldHaltBehavior = shouldHaltBehavior;
        
        // Add all behavior methods
        mobInstance.gatherBlocks = gatherBlocks;
        mobInstance.releaseBlock = releaseBlock;
        mobInstance.drawDraggedBlock = drawDraggedBlock;
        mobInstance.draggedBlock = null;
        
        mobInstance.gatherPowerUps = gatherPowerUps;
        mobInstance.releasePowerUp = releasePowerUp;
        mobInstance.drawDraggedPowerUp = drawDraggedPowerUp;
        mobInstance.draggedPowerUp = null;
        
        mobInstance.flock = flock;
        
        mobInstance.wander = wander;
        mobInstance.wanderAngle = Math.random() * Math.PI * 2;
        
        mobInstance.play = play;
        
        mobInstance.fightOtherMobs = fightOtherMobs;
        mobInstance.mobCombatCooldown = 0;
        mobInstance.defaultMobCombat = defaultMobCombat;

        mobInstance.hideFromPlayer = hideFromPlayer;

        mobInstance.inspect = inspect;
        mobInstance.inspectTarget = null;
        mobInstance.inspectStartTime = null;
        
        mobInstance.cleanupBehaviorsOnDeath = cleanupBehaviorsOnDeath;
        
        // Store which behaviors this mob should use
        mobInstance.activeBehaviors = behaviorsArray || [];
        // mark that this mob has behaviors so other code (eg. the main loop)
        // can call them even if the mob's custom do() doesn't.
        mobInstance._hasBehaviors = true;
        mobInstance.lastBehaviorsCycle = mobInstance.lastBehaviorsCycle || 0;

        mobInstance.playDead = playDead;
        
        // Wrap the onDeath to include cleanup
        const originalOnDeath = mobInstance.onDeath;
        mobInstance.onDeath = function(who) {
            this.cleanupBehaviorsOnDeath();
            if (originalOnDeath) originalOnDeath.call(this, who);
        };
        
        
        // Use custom function if provided, otherwise create a default one
        if (customDoFunction && typeof customDoFunction === 'function') {
            mobInstance.do = customDoFunction;
        } /*else if (!mobInstance.do || typeof mobInstance.do !== 'function') {
            // Create a minimal default do() function
            mobInstance.do = function() {
                this.checkStatus();
                this.gravity();
                runActiveBehaviors.call(this);
                drawDraggedObjects.call(this);
            };
        }*/
    }

//complex attack conversion kit

//  finding a mob target  (keeps existing target if in range)
function setupBasicMobTargeting(mobInstance) {
    mobInstance.combatTarget = null;
    mobInstance.combatMode = false;
    mobInstance.canFight = true;
    
    mobInstance.findMobTarget = function() {

        if (this.combatTarget && this.combatTarget.alive && mob.includes(this.combatTarget)) {
            const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, this.combatTarget.position));
            if (dist2 < (behaviorConfig.mobVsMobRange) ** 2) {
                return; 
            }
        }
        
        
        this.combatTarget = null;
        let closestMob = null;
        let closestDist2 = (behaviorConfig.mobVsMobRange) ** 2;
        
        for (let i = 0; i < mob.length; i++) {
            if (mob[i] === this || !mob[i].alive) continue;
            
            const dist2 = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position));
            if (dist2 < closestDist2) {
                closestDist2 = dist2;
                closestMob = mob[i];
            }
        }
        
        this.combatTarget = closestMob;
    };
}

// helper function: make attacks work on both player and mobs
// Call this to get the current target position (player or mob)
function getCurrentTargetPos(mobInstance) {
    if (mobInstance.combatMode && mobInstance.combatTarget && mobInstance.combatTarget.alive) {
        return mobInstance.combatTarget.position;
    }
    return m.pos; // Default to player
}

// helper function: Collision targets for raycasting
// Use this in your collision detection (vertexCollision, Matter.Query.ray, etc.)
function getCombatCollisionTargets(mobInstance) {
    if (mobInstance.combatMode && mobInstance.combatTarget) {
        return [map, body, [mobInstance.combatTarget]];
    }
    return [map, body, [playerBody, playerHead]];
}

// helper function: damage the current target (player or mob)
function damageCurrentTarget(mobInstance, damageAmount) {
    if (mobInstance.combatMode && mobInstance.combatTarget && mobInstance.combatTarget.alive) {
        // Damage mob
        mobInstance.combatTarget.damage(damageAmount);
        
        // Visual effect
        /*if (hitPosition) {
            simulation.drawList.push({
                x: hitPosition.x,
                y: hitPosition.y,
                radius: damageAmount * 1500,
                color: "rgba(80,0,255,0.5)",
                time: 20
            });
        }*/
    } else if (m.immuneCycle < m.cycle) {
        // Damage player
        m.immuneCycle = m.cycle + m.collisionImmuneCycles + 60;
        m.takeDamage(damageAmount);
        
        // Visual effect
        /*if (hitPosition) {
            simulation.drawList.push({
                x: hitPosition.x,
                y: hitPosition.y,
                radius: damageAmount * 1500,
                color: "rgba(80,0,255,0.5)",
                time: 20
            });
        }*/
    }
}

// HELPER 5: Move toward current target
function moveTowardTarget(mobInstance) {
    const targetPos = getCurrentTargetPos(mobInstance);
    const force = Vector.mult(
        Vector.normalise(Vector.sub(targetPos, mobInstance.position)),
        (mobInstance.accelMag || 0.001) * mobInstance.mass
    );
    mobInstance.force.x += force.x;
    mobInstance.force.y += force.y;
}
//full working integration of better looking mob combat 
// there are more examples in behavior combat patch.js
// setupBasicMobTargeting(mobInstance) <- used to insert the mob finding and combat system handling
// getCurrentTargetPos(mobInstance) <- use to get the current target position (player or mob)
// getCombatCollisionTargets(mobInstance) <- use in collision detection to include mob targets
// damageCurrentTarget(mobInstance, damageAmount) <- use to damage the current target (player or mob)
// moveTowardTarget(mobInstance) <- use to move the mob toward its current target
/*
stinger(x, y, radius = 18 + 4 * Math.random()) {
        const color = '#5bc'
        mobs.spawn(x, y, 7, radius, color);
        let me = mob[mob.length - 1];
        addBehaviorsToMob(mob[mob.length - 1], ['fightOtherMobs']);
        setupBasicMobTargeting(me); <- very important, or else mob wont target other mobs
        // . . . all the other mob setup code . . .

        // me.onDeath = function() {};
        me.flapRate = 0.06 + 0.03 * Math.random()
        me.flapRadius = 10 + radius * 2
        me.do = function () {
            if (this.seePlayer.recall) this.healthBar3()
            this.seePlayerByHistory()
            this.checkStatus();
            if (this.seePlayer.recall) {
                this.combatMode = false;
                this.combatTarget = null;
                me.fight();
            }
        };
        me.fight = function () {
                //whatever goes on in me.fight
        }
        me.mobCombatBehavior = function () {
            if (!this.combatTarget || !this.combatTarget.alive) return;
            this.findMobTarget();
            if (this.combatTarget) {
                this.combatMode = true;
                me.fight();
            }
            me.fight();
        }
    },
*/

    // Expose behavior APIs expected by spawn/mob code in repositories that do not ship behavior files.
    if (typeof window !== 'undefined') {
        window.addBehaviorsToMob = addBehaviorsToMob;
        window.runActiveBehaviors = runActiveBehaviors;
        window.drawDraggedObjects = drawDraggedObjects;
        window.setupBasicMobTargeting = setupBasicMobTargeting;
        window.getCurrentTargetPos = getCurrentTargetPos;
        window.getCombatCollisionTargets = getCombatCollisionTargets;
        window.damageCurrentTarget = damageCurrentTarget;
        window.moveTowardTarget = moveTowardTarget;
    }
})();

