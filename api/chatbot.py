from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai, requests
from bs4 import BeautifulSoup
from googlesearch import search
from dotenv import load_dotenv
load_dotenv()
# GROQ API Config
import os
openai.api_key = os.getenv("GROQ_API_KEY")

openai.api_base = "https://api.groq.com/openai/v1"
MODEL = "llama3-8b-8192"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Use your frontend domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

class Query(BaseModel):
    prompt: str

def fetch_top_url(query):
    try:
        for url in search(query, num_results=5):
            if any(domain in url for domain in ["shiksha.com", "careers360.com", ".ac.in", ".edu.in", ".org", ".in", ".com"]):
                return url
    except:
        return None

def scrape_text(url):
    try:
        res = requests.get(url, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(separator="\n").strip()
    except:
        return None

def ask_groq(prompt):
    try:
        response = openai.ChatCompletion.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that gives brief and accurate descriptions of topics or institutions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
        )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return f"❌ Groq API Error: {str(e)}"

@app.post("/api/chatbot")
async def chatbot(data: Query):
    user_input = data.prompt
    url = fetch_top_url(user_input)
    if url:
        scraped = scrape_text(url)
        if scraped:
            context = scraped[:3000]
            prompt = f"Give a brief and accurate description of the following topic based on this info:\n{context}"
        else:
            prompt = f"Give a short and clear explanation about: {user_input}"
    else:
        prompt = f"Give a short and clear explanation about: {user_input}"
    
    result = ask_groq(prompt)
    return {"result": result, "source": url or "None"}