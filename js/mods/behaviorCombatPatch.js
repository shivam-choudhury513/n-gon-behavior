(function installMobCombatBehaviorPatch() {
    if (typeof window !== 'undefined' && window.__ngonMobCombatBehaviorPatchInstalled) return;
    if (typeof window !== 'undefined') window.__ngonMobCombatBehaviorPatchInstalled = true;
    console.log("behavior combat patch installed");
    //this file starts the correct animation for attack for special mobs, overriding the default touch damage attack animation and making it look nicer.
    // created this cause I was too lazy to fix git conflicts when pulling, you could integrate these behaviors into the original mob code if you accept the pull request
    //debug text that tells what behavior a mob currently has
    const DEBUG_SLASHER_TEXT = typeof window !== 'undefined' && !!window.NGON_DEBUG_SLASHER_TEXT;

    function acquireMobTarget(self, range) {
        if (!self || typeof mob === 'undefined' || !Array.isArray(mob)) return null;

        const maxDist = range || 1200;
        const maxDist2 = maxDist * maxDist;
        let best = null;
        let bestDist2 = maxDist2;

        for (let i = 0; i < mob.length; i++) {
            const other = mob[i];
            if (!other || other === self || !other.alive) continue;
            // Ignore shield entities so mobs don't target their own/others' shields.
            if (other.shield) continue;
            if (other.shieldTargetID === self.id) continue;
            if (self.shieldID && other.id === self.shieldID) continue;

            const dist2 = Vector.magnitudeSquared(Vector.sub(self.position, other.position));
            if (dist2 < bestDist2) {
                bestDist2 = dist2;
                best = other;
            }
        }

        if (best) self.combatTarget = best;
        return best;
    }

    function pullTowardTarget(self, target, accelOverride) {
        if (!self || !target) return;
        const accel = accelOverride || self.accelMag || 0.0006;
        const force = Vector.mult(
            Vector.normalise(Vector.sub(target.position, self.position)),
            accel * self.mass
        );
        self.force.x += force.x;
        self.force.y += force.y;
    }
    function isSwordWaiting(self) {
        if (!self) return false;
        if (typeof self.swordWaiting === 'function' && self.sword === self.swordWaiting) return true;
        if (typeof self._originalSwordWaiting === 'function' && self.sword === self._originalSwordWaiting) return true;
        return false;
    }
    function getSwordState(self) {
        if (!self) return '?';
        if (isSwordWaiting(self)) return 'waiting';
        if (self.sword === self.swordGrow) return 'grow';
        if (self.sword === self.swordSlash) return 'slash';
        return 'other';
    }

    function pickClosestVertexIndex(self, targetPos) {
        if (!self || !self.vertices || !self.vertices.length || !targetPos) return 0;
        let idx = 0;
        let best = Infinity;
        for (let i = 0; i < self.vertices.length; i++) {
            const d2 = Vector.magnitudeSquared(Vector.sub(self.vertices[i], targetPos));
            if (d2 < best) {
                best = d2;
                idx = i;
            }
        }
        return idx;
    }

    function forceStartSword(self) {
        if (!self || typeof self.swordGrow !== 'function') return false;

        if (self.combatTarget && self.combatTarget.alive) {
            const targetPos = self.combatTarget.position;

            if (typeof self.swordVertex !== 'undefined') {
                self.swordVertex = pickClosestVertexIndex(self, targetPos);
            }

            if (typeof self.laserAngle !== 'undefined' && self.vertices && self.vertices.length) {
                const sides = self.vertices.length;
                const vertex = (typeof self.swordVertex === 'number') ? self.swordVertex : 0;
                self.laserAngle = vertex / sides * 2 * Math.PI + Math.PI / sides;
            }

            if (self.vertices && self.vertices.length && typeof self.swordVertex === 'number') {
                const v = self.vertices[self.swordVertex];
                if (v && typeof Matter !== 'undefined' && Matter.Vector) {
                    const laserStartVector = Vector.sub(self.position, v);
                    const targetVector = Vector.sub(self.position, targetPos);
                    const cross = Matter.Vector.cross(laserStartVector, targetVector);
                    self.torque = 0.00002 * self.inertia * (cross > 0 ? 1 : -1);
                }
            }
        }

        if (typeof self.cycle === 'number') self.cycle = 0;
        if (typeof self.swordRadiusInitial === 'number') {
            self.swordRadius = self.swordRadiusInitial;
        } else if (typeof self.swordRadius === 'number' && self.swordRadius <= 0) {
            self.swordRadius = 1;
        }

        self.sword = self.swordGrow;
        return true;
    }

    function drawSlasherDebug(self, phase, engageRange, dist2, clearLOS, inRange) {
        if (!DEBUG_SLASHER_TEXT) return;
        if (!self || typeof ctx === 'undefined' || !ctx || typeof ctx.fillText !== 'function') return;

        const method = self._injectedSpawnMethodName || 'slasher';
        const hasTarget = !!(self.combatTarget && self.combatTarget.alive);
        const targetId = hasTarget ? self.combatTarget.id : 'none';
        const dist = hasTarget ? Math.sqrt(typeof dist2 === 'number' ? dist2 : Vector.magnitudeSquared(Vector.sub(self.position, self.combatTarget.position))) : 0;
        const accelText = (typeof self.accelMag === 'number') ? self.accelMag.toFixed(4) : 'na';
        const cdLeft = (typeof self.cd === 'number' && typeof simulation !== 'undefined') ? Math.floor(self.cd - simulation.cycle) : 'na';

        const lines = [
            method + '#' + String(self.id),
            'phase:' + phase + ' target:' + String(targetId),
            'dist:' + (hasTarget ? dist.toFixed(0) : '-') + ' in:' + (inRange ? 'Y' : 'N') + ' los:' + (clearLOS ? 'Y' : 'N'),
            'sword:' + getSwordState(self) + ' slash:' + (self.isSlashing ? 'Y' : 'N'),
            'accel:' + accelText + ' cd:' + String(cdLeft) + ' rng:' + String(engageRange)
        ];

        const x = self.position.x + (self.radius || 20) + 8;
        const y = self.position.y - (self.radius || 20) - 44;
        const lineHeight = 11;
        const boxW = 210;
        const boxH = lines.length * lineHeight + 8;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(x - 4, y - 9, boxW, boxH);
        ctx.fillStyle = '#7ef7ff';
        ctx.font = '10px monospace';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y + i * lineHeight);
        }

        if (hasTarget) {
            ctx.beginPath();
            ctx.moveTo(self.position.x, self.position.y);
            ctx.lineTo(self.combatTarget.position.x, self.combatTarget.position.y);
            ctx.strokeStyle = 'rgba(126,247,255,0.45)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }

    function runSlasherCombat(self, engageRange) {
        const nowCycle = (typeof simulation !== 'undefined' && typeof simulation.cycle === 'number')
            ? simulation.cycle
            : 0;

        if (!self.combatTarget || !self.combatTarget.alive) {
            if (self._nextAcquireCycle === undefined || nowCycle >= self._nextAcquireCycle) {
                acquireMobTarget(self, 2000);
                self._nextAcquireCycle = nowCycle + 8;
            }
        }

        if (!self.combatTarget || !self.combatTarget.alive) {
            if (DEBUG_SLASHER_TEXT) drawSlasherDebug(self, 'no-target', engageRange, 0, false, false);
            return;
        }

        if (self._combatBaseAccel === undefined) {
            self._combatBaseAccel = self.accelMag || 0.0006;
        }
        if (self._nextSwordCycle === undefined) {
            self._nextSwordCycle = 0;
        }
        if (self._wasInSwordSequence === undefined) {
            self._wasInSwordSequence = false;
        }

        self.combatMode = true;

        const dist2 = Vector.magnitudeSquared(Vector.sub(self.position, self.combatTarget.position));
        const inRange = dist2 <= engageRange * engageRange;

        // Raycasts are expensive; only refresh frequently while inside engage range.
        let clearLOS = false;
        if (inRange) {
            const targetId = self.combatTarget.id;
            const needsLosRefresh =
                self._lastLosTargetId !== targetId ||
                self._nextLosCheckCycle === undefined ||
                nowCycle >= self._nextLosCheckCycle;

            if (needsLosRefresh) {
                self._cachedClearLOS = Matter.Query.ray(map, self.position, self.combatTarget.position).length === 0;
                self._lastLosTargetId = targetId;
                self._nextLosCheckCycle = nowCycle + 2;
            }
            clearLOS = !!self._cachedClearLOS;
        }

        const hasSwordWaiting = typeof self.swordWaiting === 'function' || typeof self._originalSwordWaiting === 'function';
        const inSwordSequence = hasSwordWaiting && !isSwordWaiting(self);

        let phase = 'chase';

        // Detect end of sword sequence even if transition happened in do() before this function.
        if (self._wasInSwordSequence && !inSwordSequence) {
            self._nextSwordCycle = Math.max(self._nextSwordCycle, nowCycle + 30);
            phase = 'recover';
        }

        const ready = nowCycle >= self._nextSwordCycle;

        if (inSwordSequence) {
            phase = 'swing';
        } else {
            self.accelMag = self._combatBaseAccel;

            if (inRange && clearLOS && ready) {
                // Start exactly one sword cycle; do() advances sword each frame.
                if (forceStartSword(self)) {
                    phase = 'force-start';
                } else {
                    phase = 'engage';
                }
            } else if (!ready) {
                phase = 'cooldown';
            }
        }

        const inSwordSequenceAfterStart = hasSwordWaiting && !isSwordWaiting(self);

        
        if (!inSwordSequenceAfterStart && !self.isSlashing) {
            const chaseAccel = phase === 'cooldown' ? self._combatBaseAccel * 1.15 : self._combatBaseAccel;
            pullTowardTarget(self, self.combatTarget, chaseAccel);
        }

        self._wasInSwordSequence = inSwordSequenceAfterStart;

        if (DEBUG_SLASHER_TEXT) drawSlasherDebug(self, phase, engageRange, dist2, clearLOS, inRange);
    }
    const slasherBeamStyleByMethod = {
        slasher2: {
            outer: 'rgba(100,100,255,0.1)',
            inner: 'rgba(100,100,255,0.5)',
            outerWidth: 15,
            innerWidth: 4
        },
        slasher3: {
            outer: 'rgba(100,100,255,0.1)',
            inner: 'rgba(100,100,255,0.5)',
            outerWidth: 15,
            innerWidth: 4
        },
        slasher4: {
            outer: 'rgba(0, 162, 255, 0.1)',
            inner: 'rgba(0, 162, 255, 0.5)',
            outerWidth: 15,
            innerWidth: 4
        },
        default: {
            outer: 'rgba(100,100,255,0.1)',
            inner: 'rgba(100,100,255,0.5)',
            outerWidth: 15,
            innerWidth: 4
        }
    };
    function drawInjectedSlasherBeam(where, hit, methodName) {
        if (typeof ctx === 'undefined' || !ctx) return;
        const style = slasherBeamStyleByMethod[methodName] || slasherBeamStyleByMethod.default;
        ctx.beginPath();
        ctx.moveTo(where.x, where.y);
        ctx.lineTo(hit.x, hit.y);
        ctx.strokeStyle = style.outer;
        ctx.lineWidth = style.outerWidth;
        ctx.stroke();
        ctx.strokeStyle = style.inner;
        ctx.lineWidth = style.innerWidth;
        ctx.setLineDash([70 + 300 * Math.random(), 55 * Math.random()]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    function applyInjectedSlasherHit(self, best, retractOnHit) {
        if (!self || !best || !best.who) return;

        // Keep original player-hit behavior for non-combat mode.
        if ((best.who === playerBody || best.who === playerHead) && m.immuneCycle < m.cycle) {
            m.immuneCycle = m.cycle + m.collisionImmuneCycles + 60;
            m.takeDamage(self.swordDamage || 0);
            if (typeof simulation !== 'undefined' && simulation.drawList && typeof best.x === 'number' && typeof best.y === 'number') {
                simulation.drawList.push({
                    x: best.x,
                    y: best.y,
                    radius: (self.swordDamage || 0) * 1500,
                    color: 'rgba(80,0,255,0.5)',
                    time: 20
                });
            }
            return;
        }

        // In combat mode, allow slasher weapons to damage the selected mob target.
        if (
            self.combatMode &&
            self.combatTarget &&
            self.combatTarget.alive &&
            best.who === self.combatTarget &&
            typeof self.combatTarget.damage === 'function'
        ) {
            if (retractOnHit && typeof self.swordRadiusGrowRateInitial === 'number' && self.swordRadiusGrowRateInitial !== 0) {
                self.swordRadiusGrowRate = 1 / self.swordRadiusGrowRateInitial;
            }
            self.combatTarget.damage(self.swordDamage || 0);
            if (typeof simulation !== 'undefined' && simulation.drawList && typeof best.x === 'number' && typeof best.y === 'number') {
                simulation.drawList.push({
                    x: best.x,
                    y: best.y,
                    radius: (self.swordDamage || 0) * 1500,
                    color: 'rgba(80,0,255,0.5)',
                    time: 20
                });
            }
        }
    }
    function makeInjectedSlasherWeaponFn(self, methodName, originalFn, retractOnHit) {
        if (typeof originalFn !== 'function') return null;
        return function injectedSlasherWeapon(where, angle, length) {
            const hasMobCombatTarget = !!(this.combatMode && this.combatTarget && this.combatTarget.alive);
            if (!hasMobCombatTarget) {
                return originalFn.apply(this, arguments);
            }

            const weaponLength =
                (typeof length === 'number')
                    ? length
                    : (typeof this.swordRadius === 'number' ? this.swordRadius : 0);

            const look = {
                x: where.x + weaponLength * Math.cos(angle),
                y: where.y + weaponLength * Math.sin(angle)
            };

            let hit = vertexCollision(where, look, [map, body, [this.combatTarget]]);
            applyInjectedSlasherHit(this, hit, retractOnHit);

            if (!hit || hit.dist2 === Infinity) {
                hit = look;
            }

            drawInjectedSlasherBeam(where, hit, methodName);
            return hit;
        };
    }
    function patchSlasherWeaponCollision(me, methodName) {
        if (!me || me._slasherWeaponCollisionPatched) return;

        if (typeof me.laserSword === 'function') {
            me._originalLaserSword = me.laserSword;
            me.laserSword = makeInjectedSlasherWeaponFn(me, methodName, me._originalLaserSword, false);
        }
        if (typeof me.laserSpear === 'function') {
            me._originalLaserSpear = me.laserSpear;
            me.laserSpear = makeInjectedSlasherWeaponFn(me, methodName, me._originalLaserSpear, true);
        }

        me._slasherWeaponCollisionPatched = true;
    }
    const mobCombatBehaviorBySpawnMethod = {
        focuser: function () {
            this.findMobTarget();
            if (this.combatTarget) {
                this.combatMode = true;
                if (typeof this.fight === 'function') this.fight();
            }
        },

        stinger: function () {
            if (!this.combatTarget || !this.combatTarget.alive) return;
            this.findMobTarget();
            if (this.combatTarget) {
                this.combatMode = true;
                if (typeof this.fight === 'function') this.fight();
            }
            if (typeof this.fight === 'function') this.fight();
        },

        slicer: function () {
            if (!this.combatTarget || !this.combatTarget.alive) return;

            const distToTarget = Vector.magnitude(Vector.sub(this.position, this.combatTarget.position));

            if (distToTarget < 500) {
                this.accelMag = 0.0015;
                if (!this.isSlashing && Matter.Query.ray(map, this.position, this.combatTarget.position).length === 0) {
                    this.sword = this.swordWaiting;
                }
            } else {
                this.accelMag = 0.0004;
            }

            pullTowardTarget(this, this.combatTarget, this.accelMag);

            if (this.cd < simulation.cycle && distToTarget > 200 && !this.isSlashing && typeof this.dodgeTeleportToTarget === 'function') {
                this.dodgeTeleportToTarget(this.combatTarget.position);
            }
        },

        slasher2: function () {
            runSlasherCombat(this, 520);
        },

        slasher3: function () {
            runSlasherCombat(this, 760);
        },

        slasher4: function () {
            runSlasherCombat(this, 620);
        }
    };
    function wrapSlasherSwordWaiting(me) {
        if (!me || me._wrappedSlasherSwordWaiting) return;
        if (typeof me.swordWaiting !== 'function') return;

        const originalWaiting = me.swordWaiting;
        me._originalSwordWaiting = originalWaiting;
        me.swordWaiting = function wrappedSlasherSwordWaiting() {
            const hasTarget = !!(this.combatTarget && this.combatTarget.alive);
            const inCooldown = (typeof simulation !== 'undefined') &&
                (typeof this._nextSwordCycle === 'number') &&
                simulation.cycle < this._nextSwordCycle;

            // During forced reposition window, suppress auto re-arming from combatTarget branch.
            if (hasTarget && inCooldown) {
                return;
            }

            return originalWaiting.call(this);
        };

        if (me.sword === originalWaiting) {
            me.sword = me.swordWaiting;
        }

        me._wrappedSlasherSwordWaiting = true;
    }
    function injectCombatBehavior(me, methodName) {
        if (!me) return;
        const behaviorFn = mobCombatBehaviorBySpawnMethod[methodName];
        if (typeof behaviorFn !== 'function') return;

        me._injectedSpawnMethodName = methodName;

        // Ensure external combat logic can run even if host spawn code omitted setup.
        me.canFight = true;
        if (typeof me.findMobTarget !== 'function' && typeof setupBasicMobTargeting === 'function') {
            setupBasicMobTargeting(me);
            me.canFight = true;
        }

        // fightOtherMobs() calls findMobTarget() before mobCombatBehavior().
        // Override slashers to use a wider target-acquisition range.
        if (methodName === 'slasher2' || methodName === 'slasher3' || methodName === 'slasher4') {
            me.findMobTarget = function () {
                const nowCycle = (typeof simulation !== 'undefined' && typeof simulation.cycle === 'number')
                    ? simulation.cycle
                    : 0;
                const missingTarget = !this.combatTarget || !this.combatTarget.alive;
                if (missingTarget || this._nextAcquireCycle === undefined || nowCycle >= this._nextAcquireCycle) {
                    acquireMobTarget(this, 2000);
                    this._nextAcquireCycle = nowCycle + 8;
                }
                return this.combatTarget || null;
            };
            wrapSlasherSwordWaiting(me);
            patchSlasherWeaponCollision(me, methodName);
        }

        me.mobCombatBehavior = behaviorFn;
    }

    function patchSpawnMethods() {
        if (typeof spawn === 'undefined' || !spawn) return false;
        if (spawn.__mobCombatBehaviorPatchesInstalled) return true;

        const methodsToPatch = Object.keys(mobCombatBehaviorBySpawnMethod);

        for (let i = 0; i < methodsToPatch.length; i++) {
            const methodName = methodsToPatch[i];
            const original = spawn[methodName];
            if (typeof original !== 'function') continue;
            if (original.__mobCombatBehaviorWrapped) continue;

            const wrapped = function wrappedSpawnMethod() {
                const before = (typeof mob !== 'undefined' && Array.isArray(mob)) ? mob.length : 0;
                const result = original.apply(this, arguments);

                if (typeof mob !== 'undefined' && Array.isArray(mob) && mob.length > before) {
                    const created = mob[before] || mob[mob.length - 1];
                    injectCombatBehavior(created, methodName);
                }

                return result;
            };

            wrapped.__mobCombatBehaviorWrapped = true;
            spawn[methodName] = wrapped;
        }

        spawn.__mobCombatBehaviorPatchesInstalled = true;
        return true;
    }

    if (patchSpawnMethods()) return;

    let retries = 0;
    const maxRetries = 120;
    const retryTimer = setInterval(function () {
        retries++;
        if (patchSpawnMethods() || retries >= maxRetries) {
            clearInterval(retryTimer);
        }
    }, 50);
})();






