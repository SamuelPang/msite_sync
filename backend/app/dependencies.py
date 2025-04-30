import os

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "exports")

# Ensure export directory exists
if not os.path.exists(EXPORT_DIR):
    os.makedirs(EXPORT_DIR)