
import sys
import os
import asyncio

# Set up paths
backend_dir = r"c:\SLIIT\Y4S2\RP\rp-project\backend"
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.modules.vishva.agent.menu_agent import MenuAgent

async def test_agent():
    print("Initializing MenuAgent...")
    try:
        agent = MenuAgent()
        print("Agent initialized successfully.")
        
        message = "Extract menu from https://tilapiyacolombo.lk/menu/"
        print(f"Streaming agent for: {message}")
        
        async for event in agent.astream(message):
            print("EVENT:", event)
            if event.get("type") == "tool_start":
                print("Tool started, stopping test (to save time)")
                break
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_agent())
