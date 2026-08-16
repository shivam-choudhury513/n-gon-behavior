(function installSpawnBehaviorPatch() {
    //installs the certain behaviors on every mob at startup
    // created this cause I was too lazy to fix git conflicts when pulling, you could integrate these behaviors into the original mob code if you accept the pull request
    if (typeof window !== 'undefined' && window.__ngonSpawnBehaviorPatchInstalled) return;
    if (typeof window !== 'undefined') window.__ngonSpawnBehaviorPatchInstalled = true;
    console.log("behavior starter patch installed");
    const behaviorBySpawnMethod = {
        beetleBoss: ['fightOtherMobs', 'wander'],
        beamer: ['wander', 'play'],
        bigSucker: ['wander', 'play', 'hideFromPlayer'],
        blinkBoss: ['wander', 'fightOtherMobs'],
        blockBoss: ['fightOtherMobs', 'wander'],
        blockMob: ['play', 'fightOtherMobs'],
        bomb: ['wander', 'play'],
        bomberBoss: ['wander', 'fightOtherMobs'],
        bounceBullet: ['wander', 'play'],
        bullet: ['wander', 'play'],
        cellBoss: ['fightOtherMobs'],
        conductorBoss: ['wander', 'fightOtherMobs'],
        defendingBoss: ['wander', 'fightOtherMobs'],
        dodger: ['wander', 'fightOtherMobs'],
        dragonFlyBoss: ['wander', 'fightOtherMobs'],
        exploder: ['wander','fightOtherMobs'],
        fabricatorBoss: ['wander', 'fightOtherMobs'],
        flutter: ['wander', 'fightOtherMobs', 'play'],
        focuser: ['wander', 'play', 'flock', 'hideFromPlayer'],
        freezeGrenade: ['wander'],
        freezer: ['wander'],
        grenadier: ['wander'],
        grenadierBoss: ['wander', 'fightOtherMobs'],
        growBoss: ['fightOtherMobs'],
        grower: ['wander', 'play', 'hideFromPlayer', 'fightOtherMobs'],
        historyBoss: ['fightOtherMobs', 'wander', 'play', 'flock'],
        hopMotherBoss: ['fightOtherMobs', 'wander', 'play', 'hideFromPlayer'],
        hopsploder: ['play', 'wander', 'fightOtherMobs'],
        hydraBoss: ['fightOtherMobs', 'wander', 'play'],
        hydraBoss2: ['fightOtherMobs', 'wander', 'play'],
        iceBlockBoss: ['fightOtherMobs'],
        kingSnakeBoss: ['wander', 'fightOtherMobs'],
        laser: ['wander', 'flock'],
        laserBaby: ['wander', 'flock'],
        laserBombingBoss: ['wander', 'fightOtherMobs'],
        laserBoss: ['wander', 'fightOtherMobs', 'flock', 'play'],
        laserLayerBoss: ['wander', 'fightOtherMobs'],
        laserTargetingBoss: ['wander', 'flock'],
        launcher: ['wander', 'play'],
        launcherBoss: ['wander', 'fightOtherMobs'],
        launchPusher: ['wander'],
        mantisBoss: ['fightOtherMobs', 'wander', 'play', 'hideFromPlayer'],
        mine: ['wander'],
        pentaLaserBoss: ['wander', 'fightOtherMobs'],
        powerUpBoss: ['fightOtherMobs', 'wander'],
        powerUpBossBaby: ['fightOtherMobs', 'wander'],
        pitcher: ['wander', 'play'],
        pulsar: ['wander', 'flock'],
        pulsarBoss: ['wander', 'fightOtherMobs'],
        quadLaser: ['wander'],
        quasarBoss: ['wander', 'fightOtherMobs'],
        revolutionBoss: ['wander', 'fightOtherMobs'],
        roundwormBoss4: ['fightOtherMobs'],
        seeker: ['wander'],
        shieldingBoss: ['wander', 'fightOtherMobs'],
        shooter: ['wander', 'play'],
        shooterBoss: ['wander', 'fightOtherMobs'],
        slashBoss: ['wander', 'fightOtherMobs', 'play'],
        slasher: ['wander', 'fightOtherMobs', 'play'],
        slasher2: ['fightOtherMobs', 'wander', 'play'],
        slasher3: ['fightOtherMobs', 'wander', 'play'],
        slasher4: ['fightOtherMobs', 'wander', 'play'],
        slasher5: ['wander'],
        slicer: ['fightOtherMobs', 'wander'],
        snakeBody: ['wander', 'play'],
        snakeBoss: ['wander', 'fightOtherMobs'],
        snakeSpitBoss: ['wander', 'fightOtherMobs'],
        sneakBoss: ['wander', 'fightOtherMobs'],
        sneakyStriker: ['wander'],
        sniper: ['wander', 'play'],
        spawnerBoss: ['fightOtherMobs', 'wander'],
        spawns: ['wander', 'play'],
        spiderBoss: ['fightOtherMobs', 'wander'],
        spiderBoss2: ['fightOtherMobs', 'wander'],
        spiderBoss3: ['fightOtherMobs', 'wander'],
        spiderBoss4: ['fightOtherMobs', 'wander'],
        spinner: ['wander', 'play'],
        stagBeetleBoss: ['wander', 'fightOtherMobs'],
        stabber: ['hideFromPlayer', 'wander', 'play'],
        starter: ['flock', 'fightOtherMobs', 'play', 'hideFromPlayer'],
        stinger: ['fightOtherMobs', 'wander'],
        streamBoss: ['wander', 'fightOtherMobs'],
        suckerBoss: ['fightOtherMobs', 'wander'],
        tendrilBody: ['fightOtherMobs', 'wander', 'hideFromPlayer'],
        tendrilBoss: ['fightOtherMobs', 'wander'],
        tendrilBoss3: ['fightOtherMobs', 'wander'],
        tetherBoss: ['wander', 'fightOtherMobs'],
        timeSkipBoss: ['wander', 'fightOtherMobs'],
        trainBoss: ['wander', 'fightOtherMobs'],
        trainBoss2: ['wander', 'fightOtherMobs'],
        tubeWormBoss: ['wander'],
        weepingAngle: ['wander']
    };

    const allowedBehaviors = new Set(['fightOtherMobs', 'wander', 'attack', 'play', 'hideFromPlayer', 'flock']);
    function normalizeBehaviorName(name) {
        if (name === 'attack') return 'fightOtherMobs';
        return name;
    }

    function sanitizeBehaviorList(list) {
        if (!Array.isArray(list)) return [];
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const raw = list[i];
            if (!allowedBehaviors.has(raw)) continue;
            const normalized = normalizeBehaviorName(raw);
            if (out.indexOf(normalized) === -1) out.push(normalized);
        }
        return out;
    }
    function ensureBehaviors(me, desiredBehaviors) {
        if (!me || !Array.isArray(desiredBehaviors) || desiredBehaviors.length === 0) return;
        if (typeof addBehaviorsToMob !== 'function') return;

        const existing = Array.isArray(me.activeBehaviors) ? me.activeBehaviors.slice() : [];
        const merged = existing.slice();
        for (let i = 0; i < desiredBehaviors.length; i++) {
            if (merged.indexOf(desiredBehaviors[i]) === -1) merged.push(desiredBehaviors[i]);
        }

        const changed = merged.length !== existing.length || !me._hasBehaviors;
        if (changed) {
            addBehaviorsToMob(me, merged);
        }

        if (merged.indexOf('fightOtherMobs') !== -1 && typeof setupBasicMobTargeting === 'function' && typeof me.findMobTarget !== 'function') {
            setupBasicMobTargeting(me);
        }
    }
    function patchSpawnMethods() {
        if (typeof spawn === 'undefined' || !spawn) return false;
        if (spawn.__behaviorMethodPatchesInstalled) return true;

        const methodsToPatch = new Set(Object.keys(behaviorBySpawnMethod));

        methodsToPatch.forEach((methodName) => {
            const original = spawn[methodName];
            if (typeof original !== 'function') return;
            if (original.__behaviorWrapped) return;

            const wrapped = function wrappedSpawnMethod() {
                const before = (typeof mob !== 'undefined' && Array.isArray(mob)) ? mob.length : 0;
                const result = original.apply(this, arguments);

                if (typeof mob === 'undefined' || !Array.isArray(mob) || mob.length <= before) return result;

                const created = mob[before] || mob[mob.length - 1];
                if (!created) return result;
                const desired = sanitizeBehaviorList(behaviorBySpawnMethod[methodName]);
                ensureBehaviors(created, desired);
                return result;
            };

            wrapped.__behaviorWrapped = true;
            spawn[methodName] = wrapped;
        });

        spawn.__behaviorMethodPatchesInstalled = true;
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



