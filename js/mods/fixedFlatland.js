const fixedFlatlandTech =
    {
        name: "flatland",
        description: "map blocks line of sight",
        maxCount: 1,
        count: 0,
        frequency: 0,
        isInstant: true,
        isJunk: true,
        allowed() { return true },
        requires: "",
        effect() {
            simulation.draw.setPaths() 
            simulation.draw.lineOfSightPrecalculation() //running the los precalculation to be rendered
            simulation.draw.drawMapPath = simulation.draw.drawMapSight

            simulation.ephemera.push({
                name: "LoS", 
                count: 0,
                lastMap: map,
                frameCount: 0,
                do() {
                    this.frameCount++;
                    
                    
                    if (this.lastMap !== map || this.frameCount % 60 === 0) {
                        if (this.lastMap !== map) {
                            console.log("Map reference changed, recalculating...");
                            this.lastMap = map;
                        }
                        
                        try {
                            simulation.draw.setPaths();
                            simulation.draw.lineOfSightPrecalculation();
                            
                            simulation.draw.drawMapPath = simulation.draw.drawMapSight;
                        } catch(e) {
                            console.error("Error recalculating:", e);
                        }
                    }
                    
                    const pos = m.pos
                    const radius = 3000
                    if (!simulation.isTimeSkipping) {
                        const vertices = simulation.sight.circleLoS(pos, radius);
                        
                        if (!vertices || vertices.length === 0) {
                            console.warn("No vertices returned from circleLoS");
                            return;
                        }
                        
                        
                        ctx.save();
                        
                        // Create clipping region for visible area
                        ctx.beginPath();
                        ctx.moveTo(vertices[0].x, vertices[0].y);
                        for (let i = 1; i < vertices.length; i++) {
                            var currentDistance = Math.sqrt((vertices[i - 1].x - pos.x) ** 2 + (vertices[i - 1].y - pos.y) ** 2);
                            var newDistance = Math.sqrt((vertices[i].x - pos.x) ** 2 + (vertices[i].y - pos.y) ** 2);
                            if (Math.abs(currentDistance - radius) < 1 && Math.abs(newDistance - radius) < 1) {
                                const currentAngle = Math.atan2(vertices[i - 1].y - pos.y, vertices[i - 1].x - pos.x);
                                const newAngle = Math.atan2(vertices[i].y - pos.y, vertices[i].x - pos.x);
                                ctx.arc(pos.x, pos.y, radius, currentAngle, newAngle);
                            } else {
                                ctx.lineTo(vertices[i].x, vertices[i].y)
                            }
                        }
                        var newDistance = Math.sqrt((vertices[0].x - pos.x) ** 2 + (vertices[0].y - pos.y) ** 2);
                        var currentDistance = Math.sqrt((vertices[vertices.length - 1].x - pos.x) ** 2 + (vertices[vertices.length - 1].y - pos.y) ** 2);
                        if (Math.abs(currentDistance - radius) < 1 && Math.abs(newDistance - radius) < 1) {
                            const currentAngle = Math.atan2(vertices[vertices.length - 1].y - pos.y, vertices[vertices.length - 1].x - pos.x);
                            const newAngle = Math.atan2(vertices[0].y - pos.y, vertices[0].x - pos.x);
                            ctx.arc(pos.x, pos.y, radius, currentAngle, newAngle);
                        } else {
                            ctx.lineTo(vertices[0].x, vertices[0].y)
                        }
                        ctx.clip();
                        
                        // Draw all map edges in faint grey
                        ctx.strokeStyle = "rgba(255, 0, 0, 1)"; // color settings for the map edges
                        ctx.lineWidth = 2;
                        for (let i = 0; i < map.length; i++) {
                            const obj = map[i];
                            ctx.beginPath();
                            ctx.moveTo(obj.vertices[0].x, obj.vertices[0].y);
                            for (let j = 1; j < obj.vertices.length; j++) {
                                ctx.lineTo(obj.vertices[j].x, obj.vertices[j].y);
                            }
                            ctx.lineTo(obj.vertices[0].x, obj.vertices[0].y); // Close the shape
                            ctx.stroke();
                        }
                        
                        ctx.restore();
                        
                        // Draw the dashed line of sight boundary to make it more clear to player that the edge of the los is not the map
                        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
                        ctx.lineWidth = 3;
                        ctx.setLineDash([50, 25]); // [dash length, gap length] - adjust these values to change the dash pattern
                        ctx.beginPath();
                        ctx.moveTo(vertices[0].x, vertices[0].y);
                        for (let i = 1; i < vertices.length; i++) {
                            var currentDistance = Math.sqrt((vertices[i - 1].x - pos.x) ** 2 + (vertices[i - 1].y - pos.y) ** 2);
                            var newDistance = Math.sqrt((vertices[i].x - pos.x) ** 2 + (vertices[i].y - pos.y) ** 2);
                            if (Math.abs(currentDistance - radius) < 1 && Math.abs(newDistance - radius) < 1) {
                                const currentAngle = Math.atan2(vertices[i - 1].y - pos.y, vertices[i - 1].x - pos.x);
                                const newAngle = Math.atan2(vertices[i].y - pos.y, vertices[i].x - pos.x);
                                ctx.arc(pos.x, pos.y, radius, currentAngle, newAngle);
                            } else {
                                ctx.lineTo(vertices[i].x, vertices[i].y)
                            }
                        }
                        var newDistance = Math.sqrt((vertices[0].x - pos.x) ** 2 + (vertices[0].y - pos.y) ** 2);
                        var currentDistance = Math.sqrt((vertices[vertices.length - 1].x - pos.x) ** 2 + (vertices[vertices.length - 1].y - pos.y) ** 2);
                        if (Math.abs(currentDistance - radius) < 1 && Math.abs(newDistance - radius) < 1) {
                            const currentAngle = Math.atan2(vertices[vertices.length - 1].y - pos.y, vertices[vertices.length - 1].x - pos.x);
                            const newAngle = Math.atan2(vertices[0].y - pos.y, vertices[0].x - pos.x);
                            ctx.arc(pos.x, pos.y, radius, currentAngle, newAngle);
                        } else {
                            ctx.lineTo(vertices[0].x, vertices[0].y)
                        }
                        ctx.stroke();
                        ctx.setLineDash([]); // Reset to solid line for other drawing
                    }
                }
            })
        },      
        remove() { 
            simulation.draw.drawMapPath = simulation.draw.drawMapPathDefault || function() {};
        }
    }

tech.tech.push(fixedFlatlandTech);