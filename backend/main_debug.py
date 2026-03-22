import traceback
import sys

try:
    print("DEBUG: Importing app from main...")
    from main import app
    import uvicorn
    print("DEBUG: App imported. Starting uvicorn...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="debug")
except Exception as e:
    print("DEBUG: Caught an exception during startup!")
    traceback.print_exc()
    sys.exit(1)
