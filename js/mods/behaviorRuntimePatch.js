(function installBehaviorRuntimePatch() {
    if (typeof window !== 'undefined' && window.__ngonBehaviorRuntimePatchInstalled) return;
    if (typeof window !== 'undefined') window.__ngonBehaviorRuntimePatchInstalled = true;
    // these functions run the behaviors of mobs every cycle.
    function ensureSafeDo(who) {
        if (!who || typeof who.do === 'function') return;
        who.do = function injectedSafeDo() {
            if (typeof this.checkStatus === 'function') this.checkStatus();
            if (typeof this.gravity === 'function') this.gravity();
            if (typeof runActiveBehaviors === 'function') runActiveBehaviors.call(this);
            if (typeof drawDraggedObjects === 'function') drawDraggedObjects.call(this);
        };
    }

    function runInjectedBehaviors(who) {
        if (!who || !who._hasBehaviors) return;
        if (typeof simulation === 'undefined') return;
        if (who.lastBehaviorsCycle === simulation.cycle) return;

        if (typeof runActiveBehaviors === 'function') runActiveBehaviors.call(who);
        if (typeof drawDraggedObjects === 'function') drawDraggedObjects.call(who);
        who.lastBehaviorsCycle = simulation.cycle;
    }

    function patchMobsLoop() {
        if (typeof mobs === 'undefined' || !mobs || typeof mobs.loop !== 'function') return false;
        if (mobs.__behaviorRuntimeLoopPatched) return true;

        const originalLoop = mobs.loop;
        mobs.loop = function wrappedMobsLoop() {
            if (typeof mob !== 'undefined' && Array.isArray(mob)) {
                for (let i = 0; i < mob.length; i++) {
                    if (mob[i] && mob[i].alive) ensureSafeDo(mob[i]);
                }
            }

            originalLoop.apply(this, arguments);

            if (typeof mob !== 'undefined' && Array.isArray(mob)) {
                for (let i = 0; i < mob.length; i++) {
                    if (mob[i] && mob[i].alive) runInjectedBehaviors(mob[i]);
                }
            }
        };

        mobs.__behaviorRuntimeLoopPatched = true;
        return true;
    }

    function patchMobsSpawn() {
        if (typeof mobs === 'undefined' || !mobs || typeof mobs.spawn !== 'function') return false;
        if (mobs.__behaviorRuntimeSpawnPatched) return true;

        const originalSpawn = mobs.spawn;
        mobs.spawn = function wrappedMobsSpawn() {
            const before = (typeof mob !== 'undefined' && Array.isArray(mob)) ? mob.length : 0;
            const result = originalSpawn.apply(this, arguments);

            if (typeof mob !== 'undefined' && Array.isArray(mob) && mob.length > before) {
                const created = mob[before] || mob[mob.length - 1];
                ensureSafeDo(created);
            }

            return result;
        };

        mobs.__behaviorRuntimeSpawnPatched = true;
        return true;
    }

    function installPatches() {
        const loopPatched = patchMobsLoop();
        const spawnPatched = patchMobsSpawn();
        return loopPatched && spawnPatched;
    }

    if (installPatches()) return;

    let retries = 0;
    const maxRetries = 120;
    const retryTimer = setInterval(function () {
        retries++;
        if (installPatches() || retries >= maxRetries) {
            clearInterval(retryTimer);
        }
    }, 50);
})();

