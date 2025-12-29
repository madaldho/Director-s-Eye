#!/usr/bin/env python3
"""
Traffic Generator for Director's Eye - Datadog Hackathon Demo
Generates realistic traffic patterns to showcase Datadog monitoring
"""

import time
import random
import requests
import json
import base64
from pathlib import Path

# Configuration
API_BASE_URL = "http://directorseye.xyz/api"
# API_BASE_URL = "http://localhost:4567/api" # Local fallback
DEMO_IMAGES = [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",  # Landscape
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",  # Forest
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",  # Portrait
]

def generate_dummy_image_data():
    """Generate dummy base64 image data for testing"""
    # This is a minimal 1x1 pixel PNG in base64
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

def simulate_analysis_request():
    """Simulate an image analysis request"""
    try:
        # Use demo mode for consistent results
        payload = {
            "image": f"data:image/png;base64,{generate_dummy_image_data()}",
            "demoMode": "true"
        }
        
        print(f"🎬 Sending analysis request...")
        response = requests.post(f"{API_BASE_URL}/analyze", json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Analysis complete - Score: {result['score']}/100")
            return True
        else:
            print(f"❌ Analysis failed - Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"🔥 Request failed: {e}")
        return False

def simulate_chat_request():
    """Simulate a chat request"""
    try:
        questions = [
            "How can I improve the lighting in this shot?",
            "What camera settings would you recommend?",
            "Is the composition following the rule of thirds?",
            "How would you describe the mood of this image?",
            "What genre does this cinematography style represent?"
        ]
        
        payload = {
            "message": random.choice(questions),
            "imageContext": generate_dummy_image_data()
        }
        
        print(f"💬 Sending chat request...")
        response = requests.post(f"{API_BASE_URL}/chat", json=payload, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Chat response received")
            return True
        else:
            print(f"❌ Chat failed - Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"🔥 Chat request failed: {e}")
        return False

def simulate_error():
    """Trigger the simulate error endpoint"""
    try:
        print(f"💥 Triggering simulated error...")
        response = requests.post(f"{API_BASE_URL}/simulate-error", timeout=5)
        print(f"🚨 Error simulation complete - Status: {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"🔥 Error simulation failed: {e}")
        return False

def check_health():
    """Check API health"""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"💚 System healthy")
            return True
        else:
            print(f"💔 System unhealthy - Status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"🔥 Health check failed: {e}")
        return False

def main():
    """Main traffic generation loop"""
    print("🚀 Starting Director's Eye Traffic Generator")
    print("📊 This will generate realistic traffic for Datadog monitoring")
    print("🎯 Perfect for demo videos and dashboard screenshots")
    print("-" * 60)
    
    # Check if API is available
    if not check_health():
        print("❌ API not available. Make sure the backend is running on localhost:5000")
        return
    
    request_count = 0
    error_count = 0
    
    try:
        while True:
            request_count += 1
            
            # Simulate different traffic patterns
            action = random.choices(
                ['analysis', 'chat', 'health', 'error'],
                weights=[60, 25, 10, 5],  # Weighted probabilities
                k=1
            )[0]
            
            print(f"\n[Request #{request_count}] Action: {action}")
            
            success = False
            if action == 'analysis':
                success = simulate_analysis_request()
            elif action == 'chat':
                success = simulate_chat_request()
            elif action == 'health':
                success = check_health()
            elif action == 'error':
                success = simulate_error()
                if success:
                    error_count += 1
            
            if not success:
                error_count += 1
            
            # Print stats every 10 requests
            if request_count % 10 == 0:
                success_rate = ((request_count - error_count) / request_count) * 100
                print(f"\n📈 Stats: {request_count} requests, {success_rate:.1f}% success rate")
            
            # Random delay between requests (1-5 seconds)
            delay = random.uniform(1, 5)
            print(f"⏱️  Waiting {delay:.1f}s...")
            time.sleep(delay)
            
    except KeyboardInterrupt:
        print(f"\n\n🛑 Traffic generation stopped")
        print(f"📊 Final stats: {request_count} requests, {error_count} errors")
        print("🎬 Check your Datadog dashboard for the generated metrics!")

if __name__ == "__main__":
    main()