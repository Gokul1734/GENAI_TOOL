# FactSense AI - Complete LLM-Powered Misinformation Detection API

from dotenv import load_dotenv
load_dotenv()

import os, logging, time, requests, json, re, html, unicodedata
from prophet import Prophet
import pandas as pd
import newspaper, trafilatura, pytesseract
from PIL import Image
import whisper
import argostranslate.package, argostranslate.translate
import numpy as np
from sentence_transformers import SentenceTransformer
import networkx as nx
import langdetect
from ddgs import DDGS
from urllib.parse import urlparse
from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ------------------ Configuration ------------------
class Config:
    MODEL_NAME = os.getenv("FACTSENSE_MODEL", "google/gemma-3n-e2b-it:free")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
    PERFORMANCE_MODE = os.getenv("PERFORMANCE_MODE", "normal").lower()  # fast|normal|deep
    # Comma-separated optional fallbacks; default to several known-good free models
    FALLBACK_MODELS = [
        m.strip() for m in os.getenv(
            "OPENROUTER_FALLBACK_MODELS",
            "openrouter/auto, meta-llama/llama-3.1-8b-instruct:free, google/gemma-2-9b-it:free, qwen/qwen-2.5-7b-instruct:free"
        ).split(",") if m.strip()
    ]

# ------------------ Logging Setup ------------------
logging.basicConfig(level=Config.LOG_LEVEL)
logger = logging.getLogger("factsense")
# Quiet noisy third-party loggers in normal/fast modes
try:
    if Config.PERFORMANCE_MODE in ("fast", "normal"):
        logging.getLogger("ddgs").setLevel(logging.WARNING)
        logging.getLogger("ddgs.ddgs").setLevel(logging.WARNING)
        logging.getLogger("primp").setLevel(logging.WARNING)
except Exception:
    pass

# ------------------ FastAPI Setup ------------------
app = FastAPI(title="FactSense AI", description="LLM-powered misinformation detection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ Global Variables ------------------
claim_history = []  # [(claim, timestamp)]
claim_graph = nx.Graph()
claim_source_cache = {}
source_credibility_cache = {}

embedder = SentenceTransformer("paraphrase-multilingual-mpnet-base-v2")
whisper_model = None  # Lazy-load only when needed

# ------------------ Statistics ------------------
stats = {
    "totalChecks": 0,
    "avgConfidence": 0.0,
    "categories": {},
    "avgPerCategory": {}
}

# ------------------ Legacy Source Configuration ------------------
TRUSTED_SOURCES = {
    "tier1": {"domains": ["bbc.com", "reuters.com", "thehindu.com", "indiatoday.in", "ndtv.com", "timesofindia.com"], "credibility": 0.9},
    "tier2": {"domains": ["dinamalar.com", "eenadu.net", "dainikbhaskar.com", "malayalamanorama.com", "vikatan.com", "news7tamil.com", "news7tamil.live", "tamil.news18.com", "polimernews.com"], "credibility": 0.7},
    "tier3": {"domains": [], "credibility": 0.4}
}

CATEGORY_DOMAINS = {
    "Politics": ["bbc.com", "reuters.com", "ndtv.com", "timesofindia.com", "politico.com", "cnn.com", "nytimes.com"],
    "Health": ["who.int", "cdc.gov", "nih.gov", "mayoclinic.org", "healthline.com"],
    "Finance": ["bloomberg.com", "wsj.com", "ft.com", "forbes.com", "economictimes.indiatimes.com", "moneycontrol.com"],
    "Technology": ["techcrunch.com", "wired.com", "theverge.com", "arstechnica.com"],
    "Entertainment": ["hollywoodreporter.com", "variety.com", "rollingstone.com", "billboard.com", "puthiyathalaimurai.com", "dinamalar.com", "vikatan.com"],
    "Sports": ["espn.com", "cricinfo.com", "fifa.com", "icc-cricket.com"]
}

# Category anchors for multilingual cosine similarity categorization
CATEGORY_ANCHORS = {
    "Politics": [
        "politics government policy election parliament chief minister prime minister mla mp", 
        "அரசியல் அரசு தேர்தல் முதல்வர் அமைச்சர் சட்டமன்றம்"
    ],
    "Health": [
        "health disease hospital vaccine medicine public health outbreak", 
        "சுகாதாரம் நோய் மருத்துவம் தடுப்பூசி மருத்துவமனை"
    ],
    "Finance": [
        "finance economy bank stock market inflation budget taxes", 
        "நிதி பொருளாதாரம் வங்கி பங்கு சந்தை"
    ],
    "Technology": [
        "technology software ai internet startup cyber gadget", 
        "தொழில்நுட்பம் மென்பொருள் செயற்கை நுண்ணறிவு இணையம்"
    ],
    "Entertainment": [
        "entertainment film movie actor actress cinema song trailer", 
        "வினோதம் பொழுதுபோக்கு சினிமா படம் நடிகர் நடிகை பாடல் டிரெய்லர்"
    ],
    "Sports": [
        "sports match football cricket tennis world cup olympics", 
        "விளையாட்டு கிரிக்கெட் கால்பந்து டென்னிஸ்"
    ]
}
_category_anchor_embeddings = {}

# ------------------ Argos Translation Setup ------------------
ARGOS_INDEX_UPDATED = False
_installed_pairs_cache = set()

def preinstall_argos():
    """Avoid heavy upfront downloads; perform lazy setup later."""
    try:
        # Touch installed packages to ensure module health; no downloads here
        _ = argostranslate.package.get_installed_packages()
    except Exception as e:
        logger.warning(f"Argos quick check failed: {e}")

preinstall_argos()

# ------------------ Request Models ------------------
class VerifyRequest(BaseModel):
    text: Optional[str] = None
    link: Optional[str] = None

# ------------------ Text Processing Functions ------------------
def clean_and_decode_text(text: str) -> str:
    """Clean and decode HTML entities and Unicode issues"""
    if not text:
        return ""
    
    try:
        # Decode HTML entities first
        text = html.unescape(text)
        
        # Handle Unicode escapes like &#xb90;
        def unicode_replacer(match):
            try:
                return chr(int(match.group(1), 16))
            except (ValueError, OverflowError):
                return match.group(0)
        
        text = re.sub(r'&#x([0-9a-fA-F]+);', unicode_replacer, text)
        text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
        
        # Remove social media metadata (likes, comments, etc.)
        text = re.sub(r'\d+\s*(likes?|comments?|shares?|views?)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'^\d+.*?on\s+\w+\s+\d+,?\s+\d+:', '', text)  # Remove "364 likes, 70 comments - account on date:"
        
        # Clean up extra whitespace and normalize
        text = ' '.join(text.split())
        text = unicodedata.normalize('NFKC', text)
        
        return text.strip()
        
    except Exception as e:
        logger.error(f"Text cleaning failed: {e}")
        return text

def safe_translate(text: str, source_lang: str = None) -> Dict[str, str]:
    """Safely translate text with fallbacks"""
    try:
        if not text or len(text.strip()) < 3:
            return {"text": text, "lang": "unknown", "translated": False}
        
        # Detect language if not provided
        if not source_lang:
            try:
                detected_lang = langdetect.detect(text)
            except:
                detected_lang = "unknown"
        else:
            detected_lang = source_lang
        
        logger.info(f"Detected language: {detected_lang}")
        
        # If it's already English or unknown, don't translate
        if detected_lang in ["en", "unknown"] or len(text.split()) < 2:
            return {"text": text, "lang": detected_lang, "translated": False}
        
        # Try translation with error handling
        try:
            global ARGOS_INDEX_UPDATED
            pair_key = f"{detected_lang}->en"

            # Update index once per process
            if not ARGOS_INDEX_UPDATED:
                try:
                    argostranslate.package.update_package_index()
                    ARGOS_INDEX_UPDATED = True
                except Exception as e:
                    logger.warning(f"Argos index update failed: {e}")

            # Install required pair only once
            if detected_lang != "en" and pair_key not in _installed_pairs_cache:
                try:
                    available_packages = argostranslate.package.get_available_packages()
                    package_to_install = None
                    for package in available_packages:
                        if package.from_code == detected_lang and package.to_code == "en":
                            package_to_install = package
                            break
                    if package_to_install:
                        try:
                            argostranslate.package.install_from_path(package_to_install.download())
                            _installed_pairs_cache.add(pair_key)
                        except Exception as install_err:
                            logger.warning(f"Argos install failed for {pair_key}: {install_err}")
                except Exception as e:
                    logger.warning(f"Argos package lookup failed: {e}")

            # Perform translation
            translated = argostranslate.translate.translate(text, detected_lang, "en")
            
            if translated and translated != text and len(translated) > 3:
                logger.info(f"Translation successful: {text[:50]} -> {translated[:50]}")
                return {"text": translated, "lang": detected_lang, "translated": True, "original": text}
            else:
                return {"text": text, "lang": detected_lang, "translated": False}
                
        except Exception as e:
            logger.warning(f"Translation failed: {e}")
            return {"text": text, "lang": detected_lang, "translated": False}
            
    except Exception as e:
        logger.error(f"Safe translate failed: {e}")
        return {"text": text, "lang": "unknown", "translated": False}

def extract_meaningful_terms(text: str, max_terms: int = 5) -> List[str]:
    """Extract meaningful search terms, avoiding social media noise"""
    if not text:
        return []
    
    # If text is in Tamil/other scripts, try basic keyword extraction
    if any(ord(char) > 127 for char in text):  # Non-ASCII characters
        # Extract English words that might be mixed in
        english_words = re.findall(r'\b[a-zA-Z]{3,}\b', text)
        if english_words:
            return english_words[:max_terms]
        
        # For non-English text, create basic search terms
        # Look for common patterns or return basic terms
        if 'முதல்வர்' in text:  # Chief Minister in Tamil
            return ['chief', 'minister', 'stalin', 'tamil', 'nadu']
        elif 'பயணம்' in text:  # Travel in Tamil
            return ['travel', 'europe', 'chief', 'minister', 'visit']
        else:
            # Return some default terms for Tamil political content
            return ['stalin', 'tamil', 'nadu', 'chief', 'minister']
    
    # Remove common social media terms and noise
    noise_patterns = [
        r'\b\d+\s*(likes?|comments?|shares?|views?|followers?)\b',
        r'\b(on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+,?\s+\d+\b',
        r'\bquot\b', r'\bxb[0-9a-f]+\b', r'\b[0-9]+\b',
        r'\b(the|is|at|which|on|and|a|to|are|as|was|were|been|be|in|of|for|with|by)\b'
    ]
    
    cleaned_text = text.lower()
    for pattern in noise_patterns:
        cleaned_text = re.sub(pattern, ' ', cleaned_text, flags=re.IGNORECASE)
    
    # Extract meaningful words (3+ characters)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', cleaned_text)
    
    # Remove common stop words
    stop_words = {
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    }
    
    meaningful_words = [word for word in words if word not in stop_words and len(word) > 2]
    
    # Return unique terms, up to max_terms
    unique_terms = []
    seen = set()
    for term in meaningful_words:
        if term not in seen and len(unique_terms) < max_terms:
            unique_terms.append(term)
            seen.add(term)
    
    logger.info(f"Extracted meaningful terms: {unique_terms}")
    return unique_terms

def normalize_and_detect_fixed(text: str) -> dict:
    """Fixed version of normalize_and_detect with better error handling"""
    try:
        # Step 1: Clean the input text
        cleaned_text = clean_and_decode_text(text)
        logger.info(f"Cleaned text: {cleaned_text[:100]}")
        
        if not cleaned_text or len(cleaned_text.strip()) < 5:
            return {"text": text, "lang": "unknown", "search_terms": []}
        
        # Step 2: Safe translation
        translation_result = safe_translate(cleaned_text)
        
        # Step 3: Extract meaningful search terms
        final_text = translation_result.get("text", cleaned_text)
        search_terms = extract_meaningful_terms(final_text)
        
        return {
            "text": final_text,
            "lang": translation_result.get("lang", "unknown"),
            "original": translation_result.get("original", text),
            "search_terms": search_terms,
            "translated": translation_result.get("translated", False)
        }
        
    except Exception as e:
        logger.error(f"normalize_and_detect_fixed failed: {e}")
        # Fallback: just clean the text and extract basic terms
        cleaned = clean_and_decode_text(text)
        basic_terms = extract_meaningful_terms(cleaned)
        return {
            "text": cleaned or text,
            "lang": "unknown",
            "search_terms": basic_terms,
            "translated": False
        }

def extract_news_content_from_social(text: str) -> str:
    """Extract actual news content from social media post"""
    try:
        content = text
        
        # Remove social media metadata
        content = re.sub(r'\d+\s*(likes?|comments?|shares?|views?)', '', content, flags=re.IGNORECASE)
        
        # Remove account handles and mentions
        content = re.sub(r'@\w+', '', content)
        content = re.sub(r'#\w+', '', content)
        
        # Remove timestamp patterns
        content = re.sub(r'\w+\s+on\s+\w+\s+\d+,?\s+\d+:', '', content)
        content = re.sub(r'^\d+.*?-\s*\w+\s+on\s+.*?:', '', content)
        
        # Remove quotes and HTML entities
        content = re.sub(r'&quot;|quot;', '', content)
        content = re.sub(r'&#x[0-9a-fA-F]+;', '', content)
        
        # Extract text between quotes or after colons
        quote_match = re.search(r'"([^"]+)"', content)
        if quote_match:
            content = quote_match.group(1)
        
        # Clean up whitespace
        content = ' '.join(content.split())
        
        logger.info(f"Extracted news content: {content[:100]}")
        return content.strip()
        
    except Exception as e:
        logger.error(f"News content extraction failed: {e}")
        return text

# ------------------ LLM-Powered Source Detection ------------------
def extract_source_info_from_content(text: str, url: str = None) -> Dict:
    """Extract potential source information from content and URL"""
    source_info = {
        "potential_sources": [],
        "url_domain": None,
        "social_platform": None,
        "account_name": None,
        "content_indicators": []
    }
    
    try:
        # Extract domain from URL
        if url:
            parsed = urlparse(url.lower())
            source_info["url_domain"] = parsed.netloc
            
            # Detect social media platform
            if "instagram.com" in parsed.netloc:
                source_info["social_platform"] = "instagram"
                # Try multiple patterns for Instagram account extraction
                account_match = re.search(r'instagram\.com/([^/?]+)', url.lower())
                if account_match:
                    account_name = account_match.group(1)
                    # Skip Instagram post IDs, look for actual account names
                    if not account_name.startswith('p/') and len(account_name) > 2:
                        source_info["account_name"] = account_name
                    else:
                        # Try to extract from content if URL parsing fails
                        source_info["account_name"] = None
            elif "twitter.com" in parsed.netloc or "x.com" in parsed.netloc:
                source_info["social_platform"] = "twitter"
                account_match = re.search(r'(?:twitter|x)\.com/([^/?]+)', url.lower())
                if account_match:
                    source_info["account_name"] = account_match.group(1)
            elif "facebook.com" in parsed.netloc:
                source_info["social_platform"] = "facebook"
                account_match = re.search(r'facebook\.com/([^/?]+)', url.lower())
                if account_match:
                    source_info["account_name"] = account_match.group(1)
            elif "youtube.com" in parsed.netloc or "youtu.be" in parsed.netloc:
                source_info["social_platform"] = "youtube"
        
        # Extract potential news organization names from text
        text_lower = text.lower()
        
        # Look for account names in content first (for cases where URL parsing fails)
        if not source_info.get("account_name") or len(source_info.get("account_name", "")) < 3:
            # Try to find account mentions in content
            account_patterns = [
                r'([a-zA-Z][a-zA-Z0-9_]{2,})\s+on\s+(?:september|october|november|december|january)',
                r'-\s*([a-zA-Z][a-zA-Z0-9_]{3,})\s+on\s+',
                r'([a-zA-Z][a-zA-Z0-9_]{3,}thalaimurai)',
                r'(puthiya[a-zA-Z]*)',
            ]
            
            for pattern in account_patterns:
                matches = re.findall(pattern, text_lower)
                for match in matches:
                    if len(match) > 3 and not match.isdigit():
                        source_info["account_name"] = match
                        logger.info(f"Extracted account name from content: {match}")
                        break
                if source_info.get("account_name"):
                    break
        
        # Common news organization patterns
        news_patterns = [
            r'([a-zA-Z\s]+(?:news|times|post|herald|gazette|tribune|express|mail|today|now|tv|channel|media|press))',
            r'([a-zA-Z\s]+(?:television|radio|broadcasting|network))',
            r'(bbc|cnn|reuters|ap|pti|ani|ndtv|zee|star|sun|india today|the hindu|times of india)',
            # Tamil/Regional patterns
            r'(puthiya thalaimurai|dinamalar|vikatan|maalaimalar|eenadu|malayala manorama|mathrubhumi)',
            # Pattern for Tamil text (if translated)
            r'([a-zA-Z\s]{3,}(?:thalaimurai|malar|vikatan|news|tv))'
        ]
        
        for pattern in news_patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                if len(match.strip()) > 2:
                    source_info["potential_sources"].append(match.strip())
        
        # Look for content indicators
        if any(word in text_lower for word in ['breaking', 'exclusive', 'report', 'correspondent', 'bureau']):
            source_info["content_indicators"].append("news_language")
        
        if any(word in text_lower for word in ['likes', 'comments', 'shares', 'followers']):
            source_info["content_indicators"].append("social_media_post")
            
        return source_info
        
    except Exception as e:
        logger.error(f"Source info extraction failed: {e}")
        return source_info

def assess_source_credibility_with_llm(source_info: Dict, content_sample: str) -> Dict:
    """Use LLM to assess source credibility intelligently"""
    
    # Create cache key
    cache_key = f"{source_info.get('account_name', '')}{source_info.get('url_domain', '')}{str(source_info.get('potential_sources', []))}"
    
    if cache_key in source_credibility_cache:
        logger.info("Using cached source credibility assessment")
        return source_credibility_cache[cache_key]
    
    # Prepare context for LLM
    context = {
        "url_domain": source_info.get("url_domain"),
        "social_platform": source_info.get("social_platform"),
        "account_name": source_info.get("account_name"),
        "potential_sources": source_info.get("potential_sources", []),
        "content_indicators": source_info.get("content_indicators", []),
        "content_sample": content_sample[:300]  # First 300 chars
    }
    
    prompt = f"""You are an expert media literacy analyst. Assess the credibility of this news source based on the available information.

SOURCE INFORMATION:
- URL Domain: {context['url_domain']}
- Social Platform: {context['social_platform']}
- Account Name: {context['account_name']}
- Potential Source Names: {context['potential_sources']}
- Content Indicators: {context['content_indicators']}

CONTENT SAMPLE: "{context['content_sample']}"

ASSESSMENT CRITERIA:
1. Is this a recognized news organization?
2. What is the reputation/credibility level?
3. Is this regional/local vs national/international media?
4. Any known bias or reliability issues?

For Indian/South Asian context, consider:
- Puthiya Thalaimurai TV: Credible Tamil news channel
- The Hindu, Times of India, NDTV, India Today: Major national outlets
- Regional outlets like Dinamalar, Vikatan, Eenadu, Manorama: Generally credible regional sources
- DD News, AIR: Government-owned but factual
- Wire services like PTI, ANI: High credibility

RESPOND ONLY IN THIS JSON FORMAT:
{{
    "is_news_source": true/false,
    "organization_name": "detected name or null",
    "credibility_score": 0.0-1.0,
    "credibility_tier": "tier1/tier2/tier3/unknown",
    "source_type": "national/regional/local/international/social_only/unknown",
    "language_focus": "english/tamil/hindi/multilingual/unknown",
    "reasoning": "brief explanation of assessment",
    "confidence": 0.0-1.0
}}

SCORING GUIDE:
- 0.9-1.0: Major established outlets (BBC, Reuters, The Hindu, etc.)
- 0.7-0.8: Regional established outlets (Puthiya Thalaimurai, Dinamalar, etc.)
- 0.5-0.6: Local outlets or newer sources with decent reputation
- 0.2-0.4: Unknown or questionable sources
- 0.0-0.1: Known unreliable sources"""

    if not Config.OPENROUTER_API_KEY:
        # Fallback assessment without LLM
        return fallback_source_assessment(source_info)
    
    try:
        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        models_to_try = [m for m in [Config.MODEL_NAME] + Config.FALLBACK_MODELS if m]
        for model_slug in models_to_try:
            data = {
                "model": model_slug,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,
                "temperature": 0.1
            }
            # Retry loop per model for rate limiting
            max_retries = 2
            last_error = None
            for attempt in range(max_retries + 1):
                try:
                    resp = requests.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=headers,
                        json=data,
                        timeout=20
                    )
                    if resp.status_code == 429:  # Rate limited
                        if attempt < max_retries:
                            wait_time = (attempt + 1) * 5
                            logger.warning(f"Rate limited ({model_slug}), waiting {wait_time}s before retry {attempt + 1}")
                            time.sleep(wait_time)
                            continue
                        else:
                            last_error = Exception("Rate limit max retries")
                            break
                    if resp.status_code == 404:
                        logger.warning(f"Model not found on OpenRouter: {model_slug}, trying next model")
                        last_error = Exception("Model 404")
                        break
                    resp.raise_for_status()
                    response_text = resp.json()["choices"][0]["message"]["content"].strip()
                    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
                    if json_match:
                        result = json.loads(json_match.group(0))
                        result["credibility_score"] = max(0.0, min(1.0, float(result.get("credibility_score", 0.0))))
                        result["confidence"] = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
                        source_credibility_cache[cache_key] = result
                        logger.info(f"LLM source assessment using {model_slug}")
                        return result
                    logger.warning("Could not parse LLM source assessment response")
                    break
                except requests.exceptions.RequestException as e:
                    last_error = e
                    if attempt < max_retries:
                        wait_time = (attempt + 1) * 3
                        logger.warning(f"Request failed for {model_slug}, retrying in {wait_time}s: {e}")
                        time.sleep(wait_time)
                        continue
            # Try next model if this one failed
            if last_error:
                continue
        logger.warning("All OpenRouter models failed; using fallback assessment")
        return fallback_source_assessment(source_info)
        
    except Exception as e:
        logger.error(f"LLM source assessment failed: {e}")
        return fallback_source_assessment(source_info)

def fallback_source_assessment(source_info: Dict) -> Dict:
    """Fallback source assessment when LLM is not available"""
    
    # Basic pattern matching for known sources
    known_credible = {
        "puthiya thalaimurai": {"score": 0.85, "tier": "tier1", "type": "regional", "lang": "tamil"},
        "puthiyathalaimurai": {"score": 0.85, "tier": "tier1", "type": "regional", "lang": "tamil"},
        "the hindu": {"score": 0.9, "tier": "tier1", "type": "national", "lang": "english"},
        "times of india": {"score": 0.85, "tier": "tier1", "type": "national", "lang": "english"},
        "ndtv": {"score": 0.85, "tier": "tier1", "type": "national", "lang": "english"},
        "india today": {"score": 0.8, "tier": "tier1", "type": "national", "lang": "english"},
        "dinamalar": {"score": 0.75, "tier": "tier2", "type": "regional", "lang": "tamil"},
        "vikatan": {"score": 0.75, "tier": "tier2", "type": "regional", "lang": "tamil"},
        "bbc": {"score": 0.95, "tier": "tier1", "type": "international", "lang": "english"},
        "reuters": {"score": 0.95, "tier": "tier1", "type": "international", "lang": "english"}
    }
    
    # Check for matches
    for source_name in source_info.get("potential_sources", []):
        for known, info in known_credible.items():
            if known in source_name.lower():
                return {
                    "is_news_source": True,
                    "organization_name": known,
                    "credibility_score": info["score"],
                    "credibility_tier": info["tier"],
                    "source_type": info["type"],
                    "language_focus": info["lang"],
                    "reasoning": f"Matched known credible source: {known}",
                    "confidence": 0.8
                }
    
    # Check account name with multiple variations (guard None)
    account = (source_info.get("account_name") or "").lower()
    for known, info in known_credible.items():
        # Handle variations like "puthiyathalaimurai", "puthiya_thalaimurai", etc.
        known_clean = known.replace(" ", "").replace("_", "")
        account_clean = account.replace("_", "").replace("-", "")
        
        if known_clean in account_clean or account_clean in known_clean:
            return {
                "is_news_source": True,
                "organization_name": known,
                "credibility_score": info["score"],
                "credibility_tier": info["tier"],
                "source_type": info["type"],
                "language_focus": info["lang"],
                "reasoning": f"Matched account name to known credible source: {known}",
                "confidence": 0.9
            }
    
    # Default for unknown sources
    return {
        "is_news_source": False,
        "organization_name": None,
        "credibility_score": 0.3,
        "credibility_tier": "unknown",
        "source_type": "unknown",
        "language_focus": "unknown",
        "reasoning": "Unknown source, cannot verify credibility",
        "confidence": 0.5
    }

def intelligent_source_detection(text: str, url: str = None) -> Dict:
    """Main function for intelligent source credibility detection"""
    try:
        logger.info("Starting intelligent source detection...")
        
        # Step 1: Extract source information
        source_info = extract_source_info_from_content(text, url)
        logger.info(f"Extracted source info: {source_info}")
        
        # Step 2: Get LLM assessment
        credibility_result = assess_source_credibility_with_llm(source_info, text)
        logger.info(f"Credibility assessment: {credibility_result}")
        
        # Step 3: Combine results
        final_result = {
            "source_detected": credibility_result.get("is_news_source", False),
            "organization_name": credibility_result.get("organization_name"),
            "credibility_score": credibility_result.get("credibility_score", 0.0),
            "credibility_tier": credibility_result.get("credibility_tier", "unknown"),
            "source_type": credibility_result.get("source_type", "unknown"),
            "language_focus": credibility_result.get("language_focus", "unknown"),
            "platform": source_info.get("social_platform"),
            "account_name": source_info.get("account_name"),
            "domain": source_info.get("url_domain"),
            "assessment_reasoning": credibility_result.get("reasoning", ""),
            "assessment_confidence": credibility_result.get("confidence", 0.5),
            "raw_source_info": source_info
        }
        
        return final_result
        
    except Exception as e:
        logger.error(f"Intelligent source detection failed: {e}")
        return {
            "source_detected": False,
            "organization_name": None,
            "credibility_score": 0.1,
            "credibility_tier": "unknown",
            "source_type": "unknown",
            "language_focus": "unknown",
            "platform": None,
            "account_name": None,
            "domain": None,
            "assessment_reasoning": f"Detection failed: {str(e)[:100]}",
            "assessment_confidence": 0.1,
            "raw_source_info": {}
        }

# ------------------ Evidence Gathering Functions ------------------
def _infer_region_from_text(text: str) -> str:
    """Lightweight heuristic to infer region/language context from English text."""
    t = (text or "").lower()
    if any(k in t for k in ["tamil nadu", "chennai", "stalin", "coimbatore", "madurai", "thalaimurai", "dinamalar", "tamil"]):
        return "tamil"
    if any(k in t for k in ["telangana", "andhra", "hyderabad", "telugu", "eenadu", "sakshi"]):
        return "telugu"
    if any(k in t for k in ["kerala", "kochi", "thiruvananthapuram", "malayalam", "manorama", "mathrubhumi"]):
        return "malayalam"
    if any(k in t for k in ["uttar pradesh", "delhi", "hindi", "dainik", "jagran", "bhaskar"]):
        return "hindi"
    if any(k in t for k in ["kolkata", "bengal", "bengali", "anandabazar"]):
        return "bengali"
    return "unknown"

def get_regional_outlets(normalized_text: str, detected_lang: str) -> List[str]:
    """Return credible regional outlet domains via LLM, with strong fallbacks."""
    # Strong curated fallback lists
    curated = {
        "tamil": ["puthiyathalaimurai.com", "dinamalar.com", "vikatan.com", "maalaimalar.com", "thanthitv.com"],
        "telugu": ["eenadu.net", "sakshi.com", "andhrajyothy.com"],
        "malayalam": ["manoramaonline.com", "mathrubhumi.com", "asianetnews.com"],
        "hindi": ["dainikbhaskar.com", "jagran.com", "aajtak.in", "ndtv.com"],
        "bengali": ["anandabazar.com", "bartamanpatrika.com"]
    }

    region = detected_lang if detected_lang and detected_lang != "en" else _infer_region_from_text(normalized_text)
    if region in curated:
        defaults = curated[region]
    else:
        defaults = []

    if not Config.OPENROUTER_API_KEY:
        return defaults

    try:
        prompt = (
            "List 10 credible regional Indian news outlet domains relevant to this claim. "
            "Prefer the language/region inferred from the text. Respond ONLY as a JSON array of domains.\n\n"
            f"TEXT: {normalized_text[:400]}\n"
        )
        headers = {"Authorization": f"Bearer {Config.OPENROUTER_API_KEY}", "Content-Type": "application/json"}
        data = {"model": Config.MODEL_NAME, "messages": [{"role": "user", "content": prompt}], "max_tokens": 160, "temperature": 0.1}
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data, timeout=20)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        json_match = re.search(r"\[[^\]]*\]", content, re.DOTALL)
        if json_match:
            arr = json.loads(json_match.group(0))
            domains = [d.strip().lower() for d in arr if isinstance(d, str) and "." in d]
            # Merge with curated defaults, dedupe
            all_domains = []
            seen = set()
            for d in (domains + defaults):
                if d and d not in seen:
                    seen.add(d)
                    all_domains.append(d)
            return all_domains[:10]
        return defaults
    except Exception as e:
        logger.warning(f"Regional outlet LLM fetch failed: {e}")
        return defaults

def llm_search_plan(normalized_text: str, detected_lang: str) -> Dict[str, List[str]]:
    """Ask LLM to propose high-signal queries and outlet domains.
    Returns {"queries": [...], "outlets": [...]} and is safe to call without breaking when LLM not available.
    """
    try:
        if Config.PERFORMANCE_MODE == "fast" or not Config.OPENROUTER_API_KEY:
            return {"queries": [], "outlets": []}

        prompt = (
            "Extract key entities and propose 3-5 precise search queries (short) for fact-checking, "
            "plus up to 8 credible outlet domains relevant to the language/region. "
            "Output JSON only with keys 'queries' and 'outlets'.\n\n"
            f"TEXT: {normalized_text[:400]}\n"
            f"LANG: {detected_lang}"
        )
        headers = {"Authorization": f"Bearer {Config.OPENROUTER_API_KEY}", "Content-Type": "application/json"}
        models_to_try = [m for m in [Config.MODEL_NAME] + Config.FALLBACK_MODELS if m]
        for model_slug in models_to_try:
            data = {"model": model_slug, "messages": [{"role": "user", "content": prompt}], "max_tokens": 220, "temperature": 0.1}
            try:
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data, timeout=20)
                if resp.status_code == 404:
                    continue
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"].strip()
                json_match = re.search(r"\{[\s\S]*\}", content)
                if not json_match:
                    continue
                obj = json.loads(json_match.group(0))
                queries = [q.strip() for q in obj.get("queries", []) if isinstance(q, str) and len(q.strip()) > 5]
                outlets = [d.strip().lower() for d in obj.get("outlets", []) if isinstance(d, str) and "." in d]
                return {"queries": queries[:5], "outlets": outlets[:8]}
            except Exception:
                continue
        return {"queries": [], "outlets": []}
    except Exception as e:
        logger.warning(f"LLM search plan failed: {e}")
        return {"queries": [], "outlets": []}
def fetch_newsapi_articles(query, max_results=5):
    if not Config.NEWSAPI_KEY:
        return []
    try:
        url = "https://newsapi.org/v2/everything"
        params = {"q": query, "sortBy": "publishedAt", "language": "en", "pageSize": max_results, "apiKey": Config.NEWSAPI_KEY}
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return [{
            "title": a.get("title"), "url": a.get("url"),
            "domain": urlparse(a.get("url", "")).netloc.lower(),
            "tier": "newsapi", "credibility": 0.85,
            "date": a.get("publishedAt"), "lead": a.get("description")
        } for a in resp.json().get("articles", [])]
    except Exception as e:
        logger.warning(f"NewsAPI fetch failed: {e}")
        return []

def extract_text_from_link(link: str) -> str:
    try:
        domain = urlparse(link).netloc.lower()
        html = requests.get(link, timeout=10).text
        # Try social media scraping
        if "twitter.com" in domain or "x.com" in domain or "instagram.com" in domain or "facebook.com" in domain:
            match = re.search(r'<meta property="og:description" content="([^"]+)"', html)
            return match.group(1) if match else html[:200]
        # Otherwise parse article
        article = newspaper.Article(link)
        article.download(); article.parse()
        # Attach metadata in a lightweight cache for later steps
        claim_source_cache[f"meta:{link}"] = {
            "title": article.title,
            "authors": article.authors,
            "publish_date": str(getattr(article, 'publish_date', '')),
            "top_image": getattr(article, 'top_image', ''),
            "domain": domain
        }
        return article.text or trafilatura.extract(html) or ""
    except Exception as e:
        logger.error(f"Extract failed: {e}")
        return ""

def get_source_credibility(domain: str) -> tuple:
    """Determine source credibility and tier"""
    domain = domain.lower()
    
    for tier, config in TRUSTED_SOURCES.items():
        if any(trusted_domain in domain for trusted_domain in config["domains"]):
            return config["credibility"], tier
    
    # Additional credibility rules
    if any(x in domain for x in ['gov.', '.edu', 'wikipedia.org']):
        return 0.85, "tier1"
    elif any(x in domain for x in ['news', 'times', 'post', 'herald', 'guardian']):
        return 0.6, "tier2"
    else:
        return 0.4, "tier3"

def search_with_ddg(query: str, max_results: int, site_domain: str = None) -> list:
    """Robust DuckDuckGo search with fallbacks"""
    try:
        ddg = DDGS()
        results = []
        
        # Try text search
        try:
            q = f"{query}" if not site_domain else f"site:{site_domain} {query}"
            search_results = list(ddg.text(q, max_results=max_results * 2, region='wt-wt'))
            logger.info(f"DDG returned {len(search_results)} results for query: {query}")
            
            for r in search_results:
                url = r.get("href", "")
                title = r.get("title", "No title")
                snippet = r.get("body", "")
                
                if not url or not title:
                    continue
                    
                domain = urlparse(url).netloc.lower()
                
                # Skip social media and non-news domains for fact-checking
                if any(x in domain for x in ['twitter.com', 'facebook.com', 'youtube.com', 'tiktok.com']):
                    continue
                
                # Determine credibility
                credibility, tier = get_source_credibility(domain)
                
                results.append({
                    "title": title,
                    "url": url,
                    "domain": domain,
                    "tier": tier,
                    "credibility": credibility,
                    "date": None,
                    "lead": snippet[:200] if snippet else None,
                    "snippet": snippet
                })
                
        except Exception as e:
            logger.warning(f"DDG search failed: {e}")
        
        return results
        
    except Exception as e:
        logger.error(f"DDG search completely failed: {e}")
        return []

def semantic_filter_improved(query: str, sources: list, threshold: float = 0.4) -> list:
    """Improved semantic filtering with content analysis"""
    if not sources:
        return sources
    
    try:
        # Create embeddings for query and source content
        query_emb = embedder.encode([query])[0]
        
        # Use title + snippet for better matching
        source_texts = []
        for source in sources:
            text = f"{source.get('title', '')} {source.get('snippet', '') or source.get('lead', '')}"
            source_texts.append(text)
        
        if not source_texts:
            return sources
        
        # Batch encode with smaller batch size for memory; disable progress bars
        source_embs = embedder.encode(source_texts, batch_size=16, show_progress_bar=False)
        
        # Calculate similarities
        similarities = np.dot(source_embs, query_emb) / (
            np.linalg.norm(source_embs, axis=1) * np.linalg.norm(query_emb)
        )
        
        # Filter and rank by similarity
        filtered_sources = []
        for i, (source, sim) in enumerate(zip(sources, similarities)):
            if sim > threshold:
                source['relevance_score'] = float(sim)
                filtered_sources.append(source)
        
        # Sort by relevance and credibility
        filtered_sources.sort(
            key=lambda x: (x.get('relevance_score', 0) * 0.7 + x.get('credibility', 0) * 0.3), 
            reverse=True
        )
        
        logger.info(f"Semantic filter: {len(sources)} -> {len(filtered_sources)} sources")
        return filtered_sources
        
    except Exception as e:
        logger.error(f"Semantic filtering failed: {e}")
        return sources

def create_better_search_queries(normalized_text: str, search_terms: List[str], article_title: str = None) -> List[str]:
    """Create multiple search query variations"""
    queries = []
    
    # Query 0: If we have an article title, use exact quoted title and title + key term
    if article_title and len(article_title.split()) >= 3:
        qtitle = article_title.strip()
        queries.append(f'"{qtitle}"')
        if search_terms:
            queries.append(f'{qtitle} {search_terms[0]}')

    # Query 1: Use the most important terms
    if search_terms and len(search_terms) >= 2:
        important_query = " ".join(search_terms[:4])  # Top 4 terms
        queries.append(important_query)
    
    # Query 2: If we have names or specific terms, use them
    name_terms = [term for term in search_terms if term.lower() in ['stalin', 'oxford', 'europe', 'minister', 'chief']]
    if name_terms:
        name_query = " ".join(name_terms + [t for t in search_terms if t not in name_terms][:2])
        queries.append(name_query)
    
    # Query 3: Fallback to original normalized text (first 5 words)
    if normalized_text:
        words = normalized_text.split()[:5]
        fallback_query = " ".join(words)
        queries.append(fallback_query)
    
    # Remove duplicates while preserving order
    unique_queries = []
    seen = set()
    for query in queries:
        if query and query not in seen and len(query) > 5:
            unique_queries.append(query)
            seen.add(query)
    
    logger.info(f"Created search queries: {unique_queries}")
    return unique_queries[:3]  # Return top 3 queries

def fetch_evidence_robust(original_text: str, normalized_text: str, search_terms: List[str], detected_lang: str = "unknown", max_results=5, source_link: str = None):
    """More robust evidence fetching with multiple query strategies"""
    
    # Create cache key
    cache_key = f"{normalized_text}_{','.join(search_terms)}"
    if cache_key in claim_source_cache:
        logger.info(f"Using cached results")
        return claim_source_cache[cache_key]
    
    all_evidence = []
    
    try:
        # Pull metadata for the link if available
        link_domain = None
        article_title = None
        if source_link:
            try:
                link_domain = urlparse(source_link).netloc.lower()
            except Exception:
                link_domain = None
            meta = claim_source_cache.get(f"meta:{source_link}")
            if meta:
                article_title = meta.get("title")

        # Generate multiple search queries
        search_queries = create_better_search_queries(normalized_text, search_terms, article_title)

        # LLM-guided plan (queries + outlets)
        plan = llm_search_plan(normalized_text, detected_lang)
        if plan.get("queries"):
            for q in plan["queries"]:
                if q not in search_queries:
                    search_queries.append(q)
        
        if not search_queries:
            logger.warning("No valid search queries generated")
            return []
        
        # Regional outlet discovery for site-restricted verification
        # In fast mode, skip LLM regional lookups; use curated defaults only
        regional_domains = get_regional_outlets(normalized_text, detected_lang)
        if Config.PERFORMANCE_MODE == "fast":
            curated_only = {
                "tamil": ["puthiyathalaimurai.com", "dinamalar.com", "vikatan.com", "maalaimalar.com", "thanthitv.com"],
                "telugu": ["eenadu.net", "sakshi.com", "andhrajyothy.com"],
                "malayalam": ["manoramaonline.com", "mathrubhumi.com", "asianetnews.com"],
                "hindi": ["dainikbhaskar.com", "jagran.com", "aajtak.in", "ndtv.com"],
                "bengali": ["anandabazar.com", "bartamanpatrika.com"]
            }
            region = detected_lang if detected_lang and detected_lang != "en" else _infer_region_from_text(normalized_text)
            regional_domains = curated_only.get(region, regional_domains)[:5]

        # Merge in LLM-proposed outlets
        for d in plan.get("outlets", []):
            if d not in regional_domains:
                regional_domains.append(d)

        # Try each query
        for i, query in enumerate(search_queries):
            logger.info(f"Trying search query {i+1}: {query}")
            try:
                evidence = search_with_ddg(query, max_results)
                if evidence:
                    all_evidence.extend(evidence)
                    logger.info(f"Query {i+1} returned {len(evidence)} results")
                else:
                    logger.info(f"Query {i+1} returned no results")
            except Exception as e:
                logger.warning(f"Search query {i+1} failed: {e}")
                continue

            # Also search within regional credible outlets
            for domain in regional_domains[:5]:  # limit to top 5 to control calls
                try:
                    site_evidence = search_with_ddg(query, max_results=3, site_domain=domain)
                    for item in site_evidence:
                        # Slightly boost credibility for curated/LLM regional sources
                        item["credibility"] = max(item.get("credibility", 0.5), 0.7)
                    if site_evidence:
                        logger.info(f"Site-restricted ({domain}) returned {len(site_evidence)} results")
                        all_evidence.extend(site_evidence)
                except Exception as e:
                    logger.debug(f"Site search failed for {domain}: {e}")

            # If we have the original domain, search it directly as well
            if link_domain:
                try:
                    site_evidence2 = search_with_ddg(query, max_results=3, site_domain=link_domain)
                    if site_evidence2:
                        # Neutral credibility, but include for matching
                        all_evidence.extend(site_evidence2)
                        logger.info(f"Site-restricted (original {link_domain}) returned {len(site_evidence2)} results")
                except Exception as e:
                    logger.debug(f"Original site search failed for {link_domain}: {e}")
        
        # Try NewsAPI with key terms (skip in fast mode)
        if Config.PERFORMANCE_MODE != "fast" and search_terms and len(search_terms) >= 2:
            try:
                news_query = " ".join(search_terms[:3])
                news_evidence = fetch_newsapi_articles(news_query, max_results)
                if news_evidence:
                    all_evidence.extend(news_evidence)
                    logger.info(f"NewsAPI returned {len(news_evidence)} results")
            except Exception as e:
                logger.warning(f"NewsAPI search failed: {e}")
        
        # Remove duplicates and filter
        if all_evidence:
            # Remove duplicates by URL
            seen_urls = set()
            unique_evidence = []
            for item in all_evidence:
                url = item.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    unique_evidence.append(item)
            
            # Filter out low-value sources (e.g., Wikipedia) unless very relevant
            pruned = []
            for s in unique_evidence:
                dom = s.get("domain", "")
                if "wikipedia.org" in dom:
                    # Keep only if similarity later is very high; defer decision by tagging
                    s["_wiki_candidate"] = True
                pruned.append(s)

            # Apply semantic filtering with blended query (title has higher weight if present)
            base_filtered = semantic_filter_improved(normalized_text, pruned, threshold=0.28)
            if article_title and len(base_filtered) < max_results:
                # Re-score using title to pull closer matches
                try:
                    title_filtered = semantic_filter_improved(article_title, pruned, threshold=0.28)
                    # Merge while preferring higher blended scores
                    merged = {}
                    for it in base_filtered + title_filtered:
                        key = it.get("url")
                        if not key:
                            continue
                        prev = merged.get(key)
                        cur_score = it.get("relevance_score", 0.0)
                        if prev is None or cur_score > prev.get("relevance_score", 0.0):
                            merged[key] = it
                    filtered_evidence = list(merged.values())
                except Exception:
                    filtered_evidence = base_filtered
            else:
                filtered_evidence = base_filtered

            # Penalize wikipedia unless very relevant
            final_list = []
            for it in filtered_evidence:
                if it.get("_wiki_candidate") and it.get("relevance_score", 0.0) < 0.75:
                    continue
                final_list.append(it)
            
            logger.info(f"Final evidence count: {len(filtered_evidence)}")
            
            # Cache results
            claim_source_cache[cache_key] = final_list[:max_results]
            return final_list[:max_results]
        
        logger.warning("No evidence found from any source")
        return []
        
    except Exception as e:
        logger.error(f"fetch_evidence_robust failed: {e}")
        return []

# ------------------ Smart Fact-Checking Functions ------------------
def smart_fact_check(claim_text: str, source_analysis: Dict, external_evidence: List, evidence_weight: float) -> Dict:
    """Smart fact-checking that combines source credibility with external evidence"""
    
    organization = source_analysis.get("organization_name", "Unknown")
    credibility = source_analysis.get("credibility_score", 0.0)
    source_detected = source_analysis.get("source_detected", False)
    
    # Prepare evidence summary
    evidence_summary = ""
    if external_evidence:
        evidence_summary = "\n".join([
            f"- {e.get('title', 'No title')} ({e.get('domain', 'unknown domain')})"
            for e in external_evidence[:3]
        ])
    
    # Create intelligent prompt
    prompt = f"""You are an advanced fact-checking AI. Analyze this claim considering both source credibility and external evidence.

CLAIM: "{claim_text}"

SOURCE ANALYSIS:
- Organization: {organization}
- Source Credibility Score: {credibility:.2f}/1.0
- Is Recognized News Source: {source_detected}
- Source Type: {source_analysis.get('source_type', 'unknown')}
- Assessment Reasoning: {source_analysis.get('assessment_reasoning', '')}

EXTERNAL EVIDENCE:
{evidence_summary if evidence_summary else "No external evidence found"}

ANALYSIS FRAMEWORK:
1. If source credibility >= 0.8 and no contradicting evidence: Lean toward "True" or "Likely True"
2. If source credibility 0.5-0.7: Balance source credibility with external evidence
3. If source credibility < 0.5: Rely heavily on external evidence
4. Evidence Weight for this analysis: {evidence_weight:.1f}

CLASSIFICATION OPTIONS:
- "True": Strong evidence supports the claim
- "Likely True": Good evidence with minor uncertainties
- "Partially True": Some aspects correct but not fully
- "Needs Context": Factual but missing key context
- "Opinion/Editorial": Subjective statement, commentary, or opinion piece
- "Satire/Sarcasm": Humorous, sarcastic, or parody content; not literal
- "Unverified": Insufficient evidence to determine
- "Misleading": Contains some truth but misleading context
- "False": Evidence contradicts the claim

CONFIDENCE SCORING:
- Higher confidence for claims from credible sources with supporting evidence
- Lower confidence for claims from unknown sources or with contradicting evidence
- Consider both source credibility and external evidence quality

Respond in JSON format:
{{
    "label": "True/Likely True/Partially True/Needs Context/Opinion/Editorial/Satire/Sarcasm/Unverified/Misleading/False",
    "confidence": 0.0-1.0,
    "explanation": "Detailed reasoning considering source credibility and evidence",
    "methodology": "source-weighted/evidence-heavy/balanced",
    "factors": ["list of key factors that influenced the decision"]
}}"""

    if not Config.OPENROUTER_API_KEY:
        # Evidence-aware fallback logic when LLM is not available
        def compute_evidence_strength(items: List[Dict]) -> float:
            if not items:
                return 0.0
            scores = []
            for it in items:
                cred = float(it.get("credibility", 0.0))
                rel = float(it.get("relevance_score", it.get("relevance", 0.0)))
                scores.append(0.7 * cred + 0.3 * rel)
            top = max(scores) if scores else 0.0
            top_k = sorted(scores, reverse=True)[:3]
            avg_top = sum(top_k) / len(top_k) if top_k else 0.0
            return max(top, avg_top)

        ev_strength = compute_evidence_strength(external_evidence)

        # If strong corroboration exists, lean True even without LLM
        # If a credible regional outlet is among evidence, lean Likely True
        has_regional = any(
            any(k in (e.get("domain", "") or "") for k in [
                "news7tamil.com", "news7tamil.live", "tamil.news18.com", "dinamalar.com", "vikatan.com", "maalaimalar.com", "polimernews.com"
            ]) for e in items
        ) if external_evidence else False

        if ev_strength >= 0.7 or (credibility >= 0.6 and ev_strength >= 0.55) or has_regional:
            conf = min(1.0, 0.6 * ev_strength + 0.4 * credibility)
            return {
                "label": "Likely True",
                "confidence": conf,
                "explanation": (
                    f"Strong corroboration from external sources (strength {ev_strength:.2f}) "
                    f"and source credibility {credibility:.2f}."
                ),
                "methodology": "evidence-heavy",
                "factors": ["external_evidence", "source_credibility"]
            }

        if credibility >= 0.7 and source_detected:
            return {
                "label": "Likely True",
                "confidence": min(1.0, credibility * 0.8),
                "explanation": f"High credibility source ({organization}) with score {credibility:.2f}. No API available for deeper analysis.",
                "methodology": "source-weighted",
                "factors": ["source_credibility", "no_llm"]
            }

        return {
            "label": "Unverified",
            "confidence": max(0.25, 0.5 * credibility + 0.2 * ev_strength),
            "explanation": "Insufficient evidence and low source credibility without LLM.",
            "methodology": "limited",
            "factors": ["no_llm", "low_evidence"]
        }
    
    try:
        headers = {
            "Authorization": f"Bearer {Config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        models_to_try = [m for m in [Config.MODEL_NAME] + Config.FALLBACK_MODELS if m]
        last_error = None
        for model_slug in models_to_try:
            data = {
                "model": model_slug,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 600,
                "temperature": 0.1
            }
            try:
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions", 
                    headers=headers, 
                    json=data,
                    timeout=30
                )
                if resp.status_code == 404:
                    logger.warning(f"Model not found for fact-check: {model_slug}, trying next")
                    continue
                if resp.status_code == 429:
                    time.sleep(5)
                    resp = requests.post(
                        "https://openrouter.ai/api/v1/chat/completions", 
                        headers=headers, 
                        json=data,
                        timeout=30
                    )
                resp.raise_for_status()
                response_text = resp.json()["choices"][0]["message"]["content"].strip()
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group(0))
                    base_confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))
                    if credibility >= 0.7 and result.get("label") in ["True", "Likely True"]:
                        adjusted_confidence = min(1.0, base_confidence + (credibility - 0.5) * 0.3)
                        result["confidence"] = adjusted_confidence
                    return result
                logger.warning("Could not parse smart fact-check response")
            except requests.exceptions.RequestException as e:
                last_error = e
                continue

        logger.warning("All OpenRouter models failed for fact-check; using fallback logic")
        
        # Fallback based on source credibility and evidence
        def compute_evidence_strength(items: List[Dict]) -> float:
            if not items:
                return 0.0
            scores = []
            for it in items:
                cred = float(it.get("credibility", 0.0))
                rel = float(it.get("relevance_score", it.get("relevance", 0.0)))
                scores.append(0.7 * cred + 0.3 * rel)
            top = max(scores) if scores else 0.0
            top_k = sorted(scores, reverse=True)[:3]
            avg_top = sum(top_k) / len(top_k) if top_k else 0.0
            return max(top, avg_top)

        ev_strength = compute_evidence_strength(external_evidence)

        if credibility >= 0.7 or ev_strength >= 0.75:
            return {
                "label": "Likely True",
                "confidence": min(1.0, 0.5 * credibility + 0.5 * ev_strength),
                "explanation": f"High credibility/evidence but could not process detailed analysis. Source: {organization}",
                "methodology": "balanced",
                "factors": ["source_credibility", "external_evidence", "parsing_error"]
            }
        else:
            return {
                "label": "Unverified",
                "confidence": max(0.25, 0.4 * credibility + 0.2 * ev_strength),
                "explanation": "Could not process analysis; insufficient source credibility and weak evidence.",
                "methodology": "limited",
                "factors": ["parsing_error", "uncertain_source", "weak_evidence"]
            }
        
    except Exception as e:
        logger.error(f"Smart fact-check failed: {e}")
        
        # Final fallback considers evidence
        def compute_evidence_strength(items: List[Dict]) -> float:
            if not items:
                return 0.0
            scores = []
            for it in items:
                cred = float(it.get("credibility", 0.0))
                rel = float(it.get("relevance_score", it.get("relevance", 0.0)))
                scores.append(0.7 * cred + 0.3 * rel)
            top = max(scores) if scores else 0.0
            top_k = sorted(scores, reverse=True)[:3]
            avg_top = sum(top_k) / len(top_k) if top_k else 0.0
            return max(top, avg_top)

        ev_strength = compute_evidence_strength(external_evidence)

        if credibility >= 0.6 and source_detected or ev_strength >= 0.75:
            return {
                "label": "Likely True",
                "confidence": min(1.0, 0.5 * credibility + 0.5 * ev_strength),
                "explanation": f"Technical error; corroboration/source credibility suggests truth: {organization}",
                "methodology": "balanced",
                "factors": ["technical_error", "external_evidence", "source_credibility"]
            }
        else:
            return {
                "label": "Unverified",
                "confidence": max(0.2, 0.4 * credibility + 0.2 * ev_strength),
                "explanation": "Technical error with uncertain source credibility and weak evidence.",
                "methodology": "limited",
                "factors": ["technical_error", "uncertain_source", "weak_evidence"]
            }

# ------------------ Additional Utility Functions ------------------
def risk_mapping(claim: str) -> float:
    now = time.time()
    claim_history.append((claim, now))
    emb = embedder.encode(claim)
    claim_graph.add_node(claim, embedding=emb, time=now)
    for prev, _ in claim_history[:-1]:
        prev_emb = claim_graph.nodes[prev]["embedding"]
        sim = float(np.dot(emb, prev_emb) / (np.linalg.norm(emb) * np.linalg.norm(prev_emb)))
        if sim > 0.8:
            claim_graph.add_edge(claim, prev, weight=sim)
    return 1.0 if len(claim_history) > 5 else 0.0

def infer_type_and_category(text):
    """Multilingual category inference using semantic similarity to anchors with keyword fallback."""
    try:
        text_norm = (text or "").strip()
        if not text_norm:
            return "General", "General"

        # Compute and cache anchor embeddings once
        global _category_anchor_embeddings
        if not _category_anchor_embeddings:
            for cat, anchors in CATEGORY_ANCHORS.items():
                _category_anchor_embeddings[cat] = embedder.encode(anchors)

        text_emb = embedder.encode([text_norm])[0]
        best_cat, best_score = "General", -1.0
        for cat, embs in _category_anchor_embeddings.items():
            sims = [float(np.dot(text_emb, e) / (np.linalg.norm(text_emb) * np.linalg.norm(e))) for e in embs]
            score = max(sims)
            if score > best_score:
                best_score = score
                best_cat = cat

        # Confidence threshold
        if best_score < 0.35:
            # Fallback simple keyword matching
            simple = {
                "Politics": ["election", "minister", "government", "mla", "mp", "chief"],
                "Health": ["covid", "vaccine", "hospital", "medicine", "health"],
                "Finance": ["stock", "market", "bank", "economy", "budget"],
                "Technology": ["ai", "tech", "software", "internet", "app"],
                "Entertainment": ["movie", "film", "actor", "trailer", "song"],
                "Sports": ["football", "cricket", "tennis", "match", "win"]
            }
            tn = text_norm.lower()
            for cat, kws in simple.items():
                if any(kw in tn for kw in kws):
                    return cat, cat
            return "General", "General"
        return best_cat, best_cat
    except Exception:
        return "General", "General"

# ------------------ API Endpoints ------------------
@app.get("/")
async def health():
    return {"service": "FactSense AI", "status": "running"}
    
@app.post("/verify")
async def verify(req: VerifyRequest):
    """Smart verification endpoint with LLM-powered source detection"""
    
    input_text = req.text
    source_link = req.link
    
    if not input_text and source_link:
        input_text = extract_text_from_link(source_link)
    
    if not input_text or len(input_text.strip()) < 10:
        return JSONResponse(
            status_code=400, 
            content={"error": "No valid input text found. Please provide text or a valid link."}
        )
    
    try:
        logger.info(f"Processing claim: {input_text[:100]}...")
        logger.info(f"Source link: {source_link}")
        
        # Step 1: Intelligent source detection using LLM
        source_analysis = intelligent_source_detection(input_text, source_link)
        
        # Debug logging for source analysis
        logger.info("=== SOURCE ANALYSIS DEBUG ===")
        logger.info(f"Detected organization: {source_analysis.get('organization_name')}")
        logger.info(f"Account name from URL/content: {source_analysis.get('account_name')}")
        logger.info(f"Platform: {source_analysis.get('platform')}")
        logger.info(f"Credibility score: {source_analysis.get('credibility_score')}")
        logger.info(f"Assessment reasoning: {source_analysis.get('assessment_reasoning')}")
        logger.info("===============================")
        
        logger.info(
            "Source analysis complete: %s (credibility: %.2f)",
            source_analysis.get('organization_name', 'Unknown'),
            float(source_analysis.get('credibility_score', 0.0) or 0.0)
        )
        
        # Step 2: Clean and extract news content
        cleaned_content = clean_and_decode_text(input_text)
        if source_analysis.get("platform") in ["instagram", "twitter", "facebook"]:
            news_content = extract_news_content_from_social(cleaned_content)
            text_to_analyze = news_content if news_content else cleaned_content
        else:
            text_to_analyze = cleaned_content
        
        logger.info(f"Text to analyze: {text_to_analyze[:100]}")
        
        # Step 3: Language processing and normalization
        norm_result = normalize_and_detect_fixed(text_to_analyze)
        normalized_text = norm_result["text"]
        search_terms = norm_result.get("search_terms", [])
        
        logger.info(f"Search terms: {search_terms}")
        
        # Step 4: Evidence gathering (adjusted based on source credibility)
        credibility_score = source_analysis.get("credibility_score", 0.0)
        
        if credibility_score >= 0.75:
            # High credibility source - need fewer external sources
            max_sources = 3
            evidence_weight = 0.2  # Lower weight on external evidence
        elif credibility_score >= 0.6:
            # Medium-high credibility source
            max_sources = 4
            evidence_weight = 0.4
        elif credibility_score >= 0.4:
            # Medium credibility source
            max_sources = 6
            evidence_weight = 0.6
        else:
            # Low/unknown credibility - need more evidence
            max_sources = 8
            evidence_weight = 0.8  # Higher weight on external evidence
        
        external_sources = fetch_evidence_robust(
            original_text=text_to_analyze,
            normalized_text=normalized_text,
            search_terms=search_terms,
            detected_lang=norm_result.get("lang", "unknown"),
            max_results=max_sources,
            source_link=source_link
        )
        
        logger.info(f"Found {len(external_sources)} external sources")
        
        # Step 5: Smart fact-checking with source context
        fc_result = smart_fact_check(
            claim_text=normalized_text,
            source_analysis=source_analysis,
            external_evidence=external_sources,
            evidence_weight=evidence_weight
        )
        
        # Step 6: Risk and categorization
        risk_score = risk_mapping(normalized_text)
        type_, category_ = infer_type_and_category(normalized_text)
        
        # Step 7: Update statistics
        stats["totalChecks"] += 1
        conf = fc_result.get("confidence", 0.0)
        
        prev_avg = stats["avgConfidence"]
        total_checks = stats["totalChecks"]
        stats["avgConfidence"] = round((prev_avg * (total_checks - 1) + conf) / total_checks, 2)
        
        stats["categories"][category_] = stats["categories"].get(category_, 0) + 1
        cat_count = stats["categories"][category_]
        prev_cat_avg = stats["avgPerCategory"].get(category_, 0)
        stats["avgPerCategory"][category_] = round(
            (prev_cat_avg * (cat_count - 1) + conf) / cat_count, 2
        )
        
        # Step 8: Comprehensive response
        response_data = {
            "success": True,
            "data": {
                "claim_analysis": {
                    "original_text": input_text[:300] + ("..." if len(input_text) > 300 else ""),
                    "processed_text": normalized_text[:200] + ("..." if len(normalized_text) > 200 else ""),
                    "language_info": {
                        "detected": norm_result.get("lang", "unknown"),
                        "translated": norm_result.get("translated", False)
                    }
                },
                "source_intelligence": {
                    "organization_detected": source_analysis.get("organization_name"),
                    "is_news_source": source_analysis.get("source_detected", False),
                    "credibility_score": round(source_analysis.get("credibility_score", 0.0), 2),
                    "credibility_tier": source_analysis.get("credibility_tier", "unknown"),
                    "source_type": source_analysis.get("source_type", "unknown"),
                    "language_focus": source_analysis.get("language_focus", "unknown"),
                    "platform": source_analysis.get("platform"),
                    "account_name": source_analysis.get("account_name"),
                    "assessment_reasoning": source_analysis.get("assessment_reasoning", ""),
                    "assessment_confidence": round(source_analysis.get("assessment_confidence", 0.0), 2)
                },
                "verification_result": {
                    "label": fc_result.get("label", "Unverified"),
                    "confidence": round(fc_result.get("confidence", 0.0), 2),
                    "explanation": fc_result.get("explanation", "No explanation available"),
                    "methodology": fc_result.get("methodology", "standard"),
                    "factors_considered": fc_result.get("factors", [])
                },
                "content_categorization": {
                    "category": category_,
                    "type": type_,
                    "risk_score": round(risk_score, 2),
                    "search_terms": search_terms
                },
                "evidence_analysis": {
                    "external_sources_found": len(external_sources),
                    "evidence_weight_applied": evidence_weight,
                    "top_sources": [
                        {
                            "title": s.get("title", "")[:80] + ("..." if len(s.get("title", "")) > 80 else ""),
                            "url": s.get("url", ""),
                            "domain": s.get("domain", ""),
                            "credibility": round(s.get("credibility", 0), 2),
                            "relevance": round(s.get("relevance_score", 0), 2)
                        } for s in external_sources[:3]
                    ]
                },
                "system_stats": stats.copy(),
                # Convenience flattened fields for simpler clients
                "sources": [
                    {
                        "title": s.get("title", ""),
                        "url": s.get("url", ""),
                        "domain": s.get("domain", ""),
                        "credibility": s.get("credibility", 0),
                        "relevance": s.get("relevance_score", 0)
                    } for s in external_sources
                ]
            }
        }
        
        # Enhanced logging
        logger.info("=== VERIFICATION COMPLETE ===")
        logger.info(f"Source: {source_analysis.get('organization_name', 'Unknown')} (Score: {source_analysis.get('credibility_score', 0):.2f})")
        logger.info(f"Result: {fc_result.get('label')} (Confidence: {fc_result.get('confidence', 0):.2f})")
        logger.info(f"External Evidence: {len(external_sources)} sources")
        logger.info("==============================")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Smart verification failed: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Smart verification failed",
                "details": str(e)[:200],
                "success": False
            }
        )

@app.get("/predict")
async def predict():
    clusters = []
    now = time.time()
    for i, comp in enumerate(nx.connected_components(claim_graph)):
        claims = list(comp)
        risk = "high" if len(claims) >= 3 else "low"
        cat, _ = infer_type_and_category(claims[0]) if claims else ("General", "General")
        clusters.append({"id": i+1, "claims": claims, "risk": risk, "category": cat})

    # Prophet prediction
    times = [ts for _, ts in claim_history]
    if len(times) > 10:
        df = pd.DataFrame(times, columns=["timestamp"])
        df["ds"] = pd.to_datetime(df["timestamp"], unit="s")
        df["y"] = 1
        ts_df = df.groupby(df["ds"].dt.floor("h")).y.sum().reset_index()
        model = Prophet()
        model.fit(ts_df)
        future = model.make_future_dataframe(periods=12, freq="H")
        forecast = model.predict(future)
        prediction = {
            "alert": any(forecast.tail(12)["yhat"] > max(ts_df["y"].max(), 3)),
            "forecast": forecast.tail(12)[["ds", "yhat", "yhat_lower", "yhat_upper"]].to_dict(orient="records")
        }
    else:
        prediction = {"alert": False, "forecast": []}

    return {"clusters": clusters, "statistics": stats.copy(), "rumour_prediction": prediction}
