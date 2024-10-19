function animate() {
    requestAnimationFrame(animate);

    // Player movement
    let forward = player.speed * Math.cos(camera.rotation.y);
    let right = player.speed * Math.sin(camera.rotation.y);
    
    if (keys.forward) {
        camera.position.z -= forward; // Move forward in camera direction
        camera.position.x -= right; 
    }
    if (keys.backward) {
        camera.position.z += forward; // Move backward in camera direction
        camera.position.x += right; 
    }
    if (keys.left) {
        camera.position.x -= player.speed * Math.cos(camera.rotation.y + Math.PI / 2); // Strafe left
        camera.position.z -= player.speed * Math.sin(camera.rotation.y + Math.PI / 2);
    }
    if (keys.right) {
        camera.position.x += player.speed * Math.cos(camera.rotation.y + Math.PI / 2); // Strafe right
        camera.position.z += player.speed * Math.sin(camera.rotation.y + Math.PI / 2);
    }

    // Raycasting to detect blocks under the player for walking up
    let raycaster = new THREE.Raycaster();
    let downVector = new THREE.Vector3(0, -1, 0); // Cast ray directly downward from the camera
    raycaster.set(camera.position, downVector);

    // Set max distance to check below the player (adjust if needed for terrain size)
    let intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
        let distanceToGround = intersects[0].distance;

        // Adjust camera position based on the distance to the ground, keeping player height consistent
        if (distanceToGround < player.height) {
            camera.position.y -= (player.height - distanceToGround);
        } else {
            camera.position.y = player.height; // Reset to default height when not walking up a block
        }
    } else {
        // If no ground is detected below the player, fall to default height
        camera.position.y = player.height;
    }

    renderer.render(scene, camera);
}
