// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1);

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png');
const dirtTexture = new THREE.TextureLoader().load('textures/dirt.png');
const stoneTexture = new THREE.TextureLoader().load('textures/stone.png');

// Inventory
const inventory = [];

// Store worlds data
const worlds = {};

// World settings
const chunkSize = 16; // Size of each chunk
const chunkHeight = 5; // Max height of blocks in a chunk
let renderDistance = 4; // Number of chunks to render around the player
let noiseScale = 0.1; // Adjust for terrain smoothness
let simplex = new SimplexNoise(); // Initialize SimplexNoise
const chunks = {}; // Object to store generated chunks

// Crosshair settings
const crosshairSize = 10; // Size of the crosshair

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x, y, z);
    return block;
}

// Function to generate a chunk
function generateChunk(chunkX, chunkZ) {
    const chunk = new THREE.Group(); // Group to hold all blocks in this chunk
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            // Generate height based on Simplex noise
            const height = Math.floor(simplex.noise2D((chunkX * chunkSize + x) * noiseScale, (chunkZ * chunkSize + z) * noiseScale) * chunkHeight);

            for (let y = 0; y <= chunkHeight; y++) {
                let texture = stoneTexture; // Default texture for blocks
                if (y === height) {
                    texture = grassTexture; // Grass on top
                } else if (y < height) {
                    texture = dirtTexture; // Dirt for blocks below the surface
                }

                const block = createBlock(chunkX * chunkSize + x, y, chunkZ * chunkSize + z, texture);
                chunk.add(block);
            }
        }
    }
    chunks[`${chunkX},${chunkZ}`] = chunk; // Store the chunk in the chunks object
    scene.add(chunk); // Add the chunk to the scene
}

// Function to update the visible chunks based on player's position
function updateChunks() {
    const playerChunkX = Math.floor(camera.position.x / chunkSize);
    const playerChunkZ = Math.floor(camera.position.z / chunkSize);

    // Determine which chunks to render
    const renderedChunks = new Set(); // Keep track of rendered chunks

    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const chunkKey = `${playerChunkX + x},${playerChunkZ + z}`;
            if (!chunks[chunkKey]) {
                generateChunk(playerChunkX + x, playerChunkZ + z); // Generate chunk if it doesn't exist
            }
            renderedChunks.add(chunkKey); // Add to the set of rendered chunks
        }
    }

    // Remove chunks that are not in the rendered set
    for (const key in chunks) {
        if (!renderedChunks.has(key)) {
            scene.remove(chunks[key]); // Remove chunk from the scene
            delete chunks[key]; // Remove from chunks object
        }
    }
}

// Function to create a new world
function makeNewWorld() {
    // Clear existing chunks
    for (const key in chunks) {
        scene.remove(chunks[key]);
        delete chunks[key];
    }

    // Reset the inventory
    inventory.length = 0; // Clear the inventory

    // Regenerate the noise generator with a new seed
    simplex = new SimplexNoise(Math.random); // Create a new SimplexNoise instance

    // Regenerate the world
    updateChunks(); // Call to generate new chunks
    document.getElementById('message').textContent = "New world created!";
}

// Collision detection function
function checkCollision(position) {
    const chunkX = Math.floor(position.x / chunkSize);
    const chunkZ = Math.floor(position.z / chunkSize);
    const chunkKey = `${chunkX},${chunkZ}`;
    const chunk = chunks[chunkKey];

    if (chunk) {
        for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
                for (let y = 0; y <= chunkHeight; y++) {
                    const block = chunk.children.find(block => block.position.equals(new THREE.Vector3(x + chunkX * chunkSize, y, z + chunkZ * chunkSize)));
                    if (block) {
                        if (position.distanceTo(block.position) < 1) {
                            return block; // Return the block if a collision is detected
                        }
                    }
                }
            }
        }
    }
    return null; // No collision
}

// Function to break a block
function breakBlock(block) {
    if (block) {
        const blockIndex = inventory.length; // Store inventory index
        inventory.push({ position: block.position.clone(), texture: block.material.map }); // Add block to inventory
        block.material.opacity = 0; // Set opacity to 0 to simulate breaking
        block.material.transparent = true; // Enable transparency
        setTimeout(() => {
            scene.remove(block); // Remove block from scene
        }, 100); // Remove block after a short delay
    }
}

// Handle movement
function updatePlayer() {
    velocity.set(0, 0, 0); // Reset velocity

    // Calculate forward and right directions based on camera rotation
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward); // Get the forward direction
    forward.y = 0; // Ignore vertical movement for walking
    forward.normalize(); // Normalize the direction

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)); // Get the right direction

    // Movement controls based on camera direction
    if (keys['KeyW']) { // Move forward (W)
        velocity.add(forward.clone().multiplyScalar(playerSpeed)); // Move in the forward direction
    }
    if (keys['KeyS']) { // Move backward (S)
        velocity.add(forward.clone().multiplyScalar(-playerSpeed)); // Move in the backward direction
    }
    if (keys['KeyA']) { // Move left (A)
        velocity.add(right.clone().multiplyScalar(-playerSpeed)); // Move in the left direction
    }
    if (keys['KeyD']) { // Move right (D)
        velocity.add(right.clone().multiplyScalar(playerSpeed)); // Move in the right direction
    }

    // Jumping logic
    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = jumpForce; // Apply jumping force
    }

    // Apply gravity
    if (isJumping) {
        velocity.y -= 0.01; // Apply a simple gravity
    }

    // Check for ground contact to reset jumping
    const previousPosition = camera.position.clone();
    camera.position.x += velocity.x;
    camera.position.y += velocity.y;
    camera.position.z += velocity.z;

    // Check for collisions after moving
    const collisionPoint = checkCollision(camera.position);
    if (collisionPoint) {
        camera.position.copy(previousPosition); // Revert to the previous position if a collision occurs
    } else {
        // Adjust height if the player is above a block
        const heightAtPlayerPosition = Math.floor(simplex.noise2D(camera.position.x * noiseScale, camera.position.z * noiseScale) * chunkHeight);
        if (camera.position.y < heightAtPlayerPosition + 1.5) {
            camera.position.y = heightAtPlayerPosition + 1.5; // Set to the height of the terrain
        }
    }

    // Handle block breaking
    if (mousePressed) {
        const blockUnderCursor = getBlockUnderCrosshair();
        breakBlock(blockUnderCursor); // Attempt to break the block
    }

    // Update visible chunks after moving
    updateChunks();
}

// Function to get the block under the crosshair
function getBlockUnderCrosshair() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Calculate mouse position in normalized device coordinates
    mouse.x = (window.innerWidth / 2) / window.innerWidth * 2 - 1;
    mouse.y = - (window.innerHeight / 2) / window.innerHeight * 2 + 1;

    raycaster.setFromCamera(mouse, camera); // Create a raycaster from camera
    const intersects = raycaster.intersectObjects(scene.children); // Check intersections with blocks

    return intersects.length > 0 ? intersects[0].object : null; // Return the first intersected object
}

// Crosshair drawing
function drawCrosshair() {
    const ctx = renderer.getContext();
    ctx.save();
    ctx.fillStyle = 'white'; // Crosshair color
    ctx.font = 'bold ' + crosshairSize + 'px Arial'; // Set font and size
    ctx.fillText('+', window.innerWidth / 2 - crosshairSize / 2, window.innerHeight / 2 + crosshairSize / 2); // Draw crosshair
    ctx.restore();
}

// Event listeners for mouse controls
let mousePressed = false;

document.addEventListener('mousedown', () => {
    mousePressed = true; // Set mouse pressed state
});

document.addEventListener('mouseup', () => {
    mousePressed = false; // Reset mouse pressed state
});

// Key controls
const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.code] = true; // Track key states
});

document.addEventListener('keyup', (event) => {
    keys[event.code] = false; // Reset key state
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player movement and collision
    drawCrosshair(); // Draw crosshair
    renderer.render(scene, camera); // Render the scene
}

// Start animation
animate();
