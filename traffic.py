import requests
import time
import random
import sys
import threading

# Configuration
BASE_URL = "http://localhost:4567"
ENDPOINTS = {
    "health": "/api/health",
    "analyze": "/api/analyze",
    "chat": "/api/chat",
    "gallery": "/api/gallery"
}

# Sample payloads
SAMPLE_CHAT = {
    "message": "How is the lighting in this shot?",
    "history": [],
    "imageContext": None,
    "analysisContext": None
}

# Image simulation (base64 placeholder)
SAMPLE_IMAGE_B64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAQECAQECAgICAgICAgMFAwMDAwMGBAQDBQcHBwcHBwcHBwoLCAcHCQcHBwkMCgwMDAwMDAcJDg4MDAwMDAwM/9oADAMBAAIRAxEAPwD9/KKKKAP/2Q=="

def log(msg, type="INFO"):
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{type}] {msg}")

def run_health_check():
    try:
        start = time.time()
        resp = requests.get(f"{BASE_URL}{ENDPOINTS['health']}")
        duration = (time.time() - start) * 1000
        if resp.status_code == 200:
            log(f"Health Check OK ({duration:.0f}ms)")
        else:
            log(f"Health Check Failed: {resp.status_code}", "ERROR")
    except Exception as e:
        log(f"Health Check Connection Failed: {e}", "CRITICAL")

def run_chat_simulation():
    try:
        start = time.time()
        # 10% chance to simulate a bad request (400)
        if random.random() < 0.1:
            resp = requests.post(f"{BASE_URL}{ENDPOINTS['chat']}", json={}) # Empty body
            log(f"Simulated Bad Chat Request: {resp.status_code}", "WARN")
        else:
            resp = requests.post(f"{BASE_URL}{ENDPOINTS['chat']}", json=SAMPLE_CHAT)
            duration = (time.time() - start) * 1000
            if resp.status_code == 200:
                log(f"Chat Response OK ({duration:.0f}ms)")
            else:
                log(f"Chat Logic Error: {resp.status_code}", "ERROR")
    except Exception as e:
        log(f"Chat Connection Failed: {e}", "CRITICAL")

def run_analysis_simulation():
    try:
        # 5% chance to simulate Server Error (500) - Useful for Error Rate Monitor
        if random.random() < 0.05:
            # We assume the server handles malformed image data gracefully, 
            # so to trigger a 500 we might need to rely on the server's error injection or just bad data
            resp = requests.post(f"{BASE_URL}{ENDPOINTS['analyze']}", json={"image": "invalid-garbage"})
            log(f"Simulated Analysis 500 Attempt: {resp.status_code}", "WARN")
        else:
            # Normal request
            resp = requests.post(f"{BASE_URL}{ENDPOINTS['analyze']}", json={"image": SAMPLE_IMAGE_B64})
            if resp.status_code == 200:
                log(f"Image Analysis OK")
            else:
                log(f"Image Analysis Failed: {resp.status_code}", "ERROR")
    except Exception as e:
        log(f"Analysis Connection Failed: {e}", "CRITICAL")

def main():
    print("🚦 Director's Eye Traffic Generator Started")
    print("   Generating traffic to: " + BASE_URL)
    print("   Press Ctrl+C to stop.")
    print("------------------------------------------")

    try:
        while True:
            # Randomly pick an action
            action = random.choice(['health', 'chat', 'analyze', 'gallery'])
            
            if action == 'health':
                run_health_check()
            elif action == 'chat':
                run_chat_simulation()
            elif action == 'analyze':
                run_analysis_simulation()
            elif action == 'gallery':
                try:
                    requests.get(f"{BASE_URL}{ENDPOINTS['gallery']}")
                    log("Gallery Feed Checked")
                except:
                    pass

            # Random sleep between 0.5s and 3s
            time.sleep(random.uniform(0.5, 3.0))

    except KeyboardInterrupt:
        print("\n🛑 Traffic Generator Stopped")

if __name__ == "__main__":
    main()
