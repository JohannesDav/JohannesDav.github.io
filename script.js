const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const content = document.querySelector('.content');
const linkedinLink = document.getElementById('linkedin-link');

let width, height, centerX, centerY;
let boids = [];
let lastTimestamp = 0;
const avoidFactor = 0.0175;
const matchingFactor = 0.025;
const centeringFactor = 0.0025;
const avoidCenterFactor = 0.01;
const turnFactor = 0.5;
let grid = {};
const spikeDuration = 500;
const spikeColor = '#4a90e2';
const refractoryPeriod = 750;
const spikePropagationDelay = 100;
let gridSize, visualRange, maxSpeed, minSpeed, edgeMargin, mouseSpikeRadius;


function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    if (width > 768) {
        visualRange = 50;
        maxSpeed = 1.0;
        minSpeed = 0.5;
        edgeMargin = 15;
        mouseSpikeRadius = 40;
    } else {
        visualRange = 30;
        maxSpeed = 0.8;
        minSpeed = 0.4;
        edgeMargin = 7;
        mouseSpikeRadius = 40;
    }

    gridSize = visualRange + 1;

    if (width < 300 || height < 450) {
        setBoidsCount(0);
    }
    else if (width > 768) {
        setBoidsCount(250);
    }
    else {
        setBoidsCount(110);
    }
}

function getValidRandomBoid() {
    const contentRect = content.getBoundingClientRect();
    let x, y;
    do {
        x = Math.random() * width;
        y = Math.random() * height;
    } while (
        x > contentRect.left - edgeMargin && x < contentRect.right + edgeMargin &&
        y > contentRect.top - edgeMargin && y < contentRect.bottom + edgeMargin
    );

    return {
        x: x,
        y: y,
        dx: Math.random() * 2 - 1,
        dy: Math.random() * 2 - 1,
        spiking: false,
        lastSpikeTime: 0
    };

}

function setBoidsCount(newCount) {
    const currentCount = boids.length;

    if (newCount === currentCount) return;

    if (newCount > currentCount) {
        for (let i = 0; i < (newCount - currentCount); i++) {
            boids.push(getValidRandomBoid());
        }
    } else if (newCount < currentCount) {
        boids = boids.slice(0, newCount);
    }

    updateGrid();
}

function updateGrid() {
    grid = {};
    boids.forEach((boid, index) => {
        const gridX = Math.floor(boid.x / gridSize);
        const gridY = Math.floor(boid.y / gridSize);
        const key = `${gridX},${gridY}`;
        if (!grid[key]) {
            grid[key] = [];
        }
        grid[key].push(index);
    });
}

function getNearbyBoids(boid) {
    const gridX = Math.floor(boid.x / gridSize);
    const gridY = Math.floor(boid.y / gridSize);
    const nearby = [];

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const key = `${gridX + i},${gridY + j}`;
            if (grid[key]) {
                nearby.push(...grid[key]);
            }
        }
    }

    return nearby.map(index => boids[index]).filter(b => b !== boid && distance(boid, b) < visualRange);
}

function distance(boid1, boid2) {
    return Math.sqrt((boid1.x - boid2.x) ** 2 + (boid1.y - boid2.y) ** 2);
}

function avoidCollisions(boid, nearby) {

    let moveX = 0;
    let moveY = 0;
    nearby.forEach(other => {
        if (distance(boid, other) < visualRange / 2) {
            moveX += boid.x - other.x;
            moveY += boid.y - other.y;
        }
    });
    return [moveX * avoidFactor, moveY * avoidFactor];
}

function matchVelocity(boid, nearby) {
    if (nearby.length === 0) return [0, 0];
    let avgDX = 0;
    let avgDY = 0;
    nearby.forEach(other => {
        avgDX += other.dx;
        avgDY += other.dy;
    });
    avgDX /= nearby.length;
    avgDY /= nearby.length;
    return [(avgDX - boid.dx) * matchingFactor, (avgDY - boid.dy) * matchingFactor];
}

function moveToCenter(boid, nearby) {
    if (nearby.length === 0) return [0, 0];
    let centerX = 0;
    let centerY = 0;
    nearby.forEach(other => {
        centerX += other.x;
        centerY += other.y;
    });
    centerX /= nearby.length;
    centerY /= nearby.length;
    return [(centerX - boid.x) * centeringFactor, (centerY - boid.y) * centeringFactor];
}

function avoidCenter(boid) {
    const contentRect = content.getBoundingClientRect();
    const centerX = contentRect.left + contentRect.width / 2;
    const centerY = contentRect.top + contentRect.height / 2;
    const dx = boid.x - centerX;
    const dy = boid.y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    const contentDia = Math.sqrt(contentRect.width ** 2 + contentRect.height ** 2) / 2 + edgeMargin;
    const repulsionStrength = Math.max(0, 1.0 - distanceFromCenter / contentDia);
    return [dx * repulsionStrength * avoidCenterFactor, dy * repulsionStrength * avoidCenterFactor];
}

function limitSpeed(boid) {
    const speed = Math.sqrt(boid.dx * boid.dx + boid.dy * boid.dy);
    if (speed > maxSpeed) {
        boid.dx = (boid.dx / speed) * maxSpeed;
        boid.dy = (boid.dy / speed) * maxSpeed;
    }
    if (speed < minSpeed) {
        boid.dx = (boid.dx / speed) * minSpeed;
        boid.dy = (boid.dy / speed) * minSpeed;
    }
}

function keepWithinBounds(boid) {
    if (boid.x < edgeMargin) boid.dx += turnFactor;
    if (boid.x > width - edgeMargin) boid.dx -= turnFactor;
    if (boid.y < edgeMargin) boid.dy += turnFactor;
    if (boid.y > height - edgeMargin) boid.dy -= turnFactor;

    if (boid.x < -edgeMargin || boid.x > width + edgeMargin || boid.y < -edgeMargin || boid.y > height + edgeMargin) {
        const index = boids.indexOf(boid);
        boids[index] = getValidRandomBoid();
    }
}

function updateBoid(boid, deltatime) {
    const timeFactor = deltatime / (1 / 60);
    const nearby = getNearbyBoids(boid);
    const [avoidX, avoidY] = avoidCollisions(boid, nearby);
    const [matchX, matchY] = matchVelocity(boid, nearby);
    const [centerX, centerY] = moveToCenter(boid, nearby);
    const [repelX, repelY] = avoidCenter(boid);

    boid.dx += (avoidX + matchX + centerX + repelX) * timeFactor;
    boid.dy += (avoidY + matchY + centerY + repelY) * timeFactor;

    limitSpeed(boid);
    keepWithinBounds(boid);

    boid.x += boid.dx * timeFactor;
    boid.y += boid.dy * timeFactor;
}

function drawBoid(boid) {
    ctx.beginPath();
    ctx.arc(boid.x, boid.y, 3, 0, 2 * Math.PI);
    if (boid.spiking) {
        const progress = (Date.now() - boid.lastSpikeTime) / spikeDuration;
        const alpha = 1 - progress;
        ctx.fillStyle = `rgba(74, 144, 226, ${alpha})`;
        ctx.strokeStyle = `rgba(74, 144, 226, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    } else {
        ctx.fillStyle = '#808080';
    }
    ctx.fill();
}

function spikeBoid(boid, enforceRefractory) {
    if (!enforceRefractory || Date.now() - boid.lastSpikeTime > refractoryPeriod) {
        boid.spiking = true;
        boid.lastSpikeTime = Date.now();
        setTimeout(() => {
            boid.spiking = false;
        }, spikeDuration);

        const nearby = getNearbyBoids(boid);
        nearby.forEach((nearbyBoid, index) => {
            setTimeout(() => {
                if (Date.now() - nearbyBoid.lastSpikeTime > refractoryPeriod) {
                    spikeBoid(nearbyBoid, true);
                }
            }, spikePropagationDelay);
        });
    }
}

function animate(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp - 1 / 60;
    }
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, width, height);
    if (boids.length > 0) {
        boids.forEach(boid => updateBoid(boid, deltaTime));
        boids.forEach(drawBoid);
        updateGrid();
    }
    requestAnimationFrame(animate);
}

canvas.addEventListener('mousemove', (event) => {
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    boids.forEach(boid => {
        if (Math.sqrt((boid.x - mouseX) ** 2 + (boid.y - mouseY) ** 2) < mouseSpikeRadius) {
            spikeBoid(boid, false);
        }
    });
});

canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    boids.forEach(boid => {
        if (Math.sqrt((boid.x - touchX) ** 2 + (boid.y - touchY) ** 2) < mouseSpikeRadius) {
            spikeBoid(boid, false);
        }
    });
});

linkedinLink.addEventListener('click', (event) => {
    event.preventDefault();
    boids.forEach(boid => {
        spikeBoid(boid, false);
    });
    setTimeout(() => {
        window.location.href = linkedinLink.href;
    }, spikeDuration);
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(animate);