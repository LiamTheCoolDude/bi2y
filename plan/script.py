import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("C:/Users/liaml/Documents/Coding Projects/ai/bible-in-2-years-firebase-adminsdk-fbsvc-d8b04da7fd.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

from pathlib import Path

excel_path = Path(__file__).resolve().parent / "Bible in 2 Years.xlsx"
df1 = pd.read_excel(excel_path, sheet_name="Year 1 Law and History")
df2 = pd.read_excel(excel_path, sheet_name="Year 2 Wisdom and Prophets")

days = []
for df in [df1, df2]:
    for _, row in df.iterrows():
        days.append([
            str(row['Old Testament']) if pd.notna(row['Old Testament']) else "",
            str(row['New Testament']) if pd.notna(row['New Testament']) else "",
            str(row['Psalm']) if pd.notna(row['Psalm']) else ""
        ])

db.collection("plan").document("main").set({
    "start": "2026-11-05",
    "days": days
})

print("Uploaded sucessfully!")