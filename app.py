from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import re

app = Flask(__name__)

def clean_html_for_text(html_content):
    """
    Converts HTML into clean plain text for search and tweet previews.
    Replaces links with 'Text (URL)' to preserve them, and strips other tags.
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Process anchor tags to include URLs in parentheses
    for a in soup.find_all('a'):
        href = a.get('href')
        if href:
            # Ensure URL is absolute (relative URLs are rare in GCP feed, but handle just in case)
            if href.startswith('/'):
                href = f"https://cloud.google.com{href}"
            link_text = a.get_text().strip()
            if link_text:
                if link_text.lower() in href.lower() or href.lower() in link_text.lower():
                    # Avoid duplication if the text is the link itself
                    a.replace_with(href)
                else:
                    a.replace_with(f"{link_text} ({href})")
            else:
                a.replace_with(href)
                
    # Get text and clean up whitespace
    text = soup.get_text()
    # Replace multiple spaces/newlines with single ones
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def fetch_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch BigQuery release notes. HTTP Status: {response.status_code}")
        
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    all_updates = []
    
    # Process each <entry>
    for entry in root.findall('atom:entry', ns):
        date_title = entry.find('atom:title', ns).text
        updated = entry.find('atom:updated', ns).text
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        content_elem = entry.find('atom:content', ns)
        if content_elem is None or not content_elem.text:
            continue
            
        content_html = content_elem.text
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Release notes content usually has <h3>Type</h3> followed by siblings.
        # Let's segment the html content by <h3> headers.
        current_type = None
        current_elements = []
        
        # We process the children of the BS4 soup object
        for child in soup.children:
            if child.name == 'h3':
                # If we had a previous block, save it before starting the next
                if current_elements:
                    html_str = "".join(str(el) for el in current_elements).strip()
                    if html_str:
                        all_updates.append({
                            'date': date_title,
                            'updated': updated,
                            'link': link,
                            'type': current_type or 'Update',
                            'html': html_str,
                            'text': clean_html_for_text(html_str)
                        })
                current_type = child.get_text().strip()
                current_elements = []
            elif child.name is not None:
                current_elements.append(child)
            elif str(child).strip():
                # Handle text nodes directly
                current_elements.append(child)
                
        # Handle the remaining trailing block
        if current_elements or current_type:
            html_str = "".join(str(el) for el in current_elements).strip()
            if html_str:
                all_updates.append({
                    'date': date_title,
                    'updated': updated,
                    'link': link,
                    'type': current_type or 'Update',
                    'html': html_str,
                    'text': clean_html_for_text(html_str)
                })
                
    # Sort updates chronologically if needed (the XML is usually sorted latest first)
    return all_updates

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        notes = fetch_release_notes()
        return jsonify({
            'success': True,
            'data': notes,
            'count': len(notes)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Running on port 5000 by default
    app.run(debug=True, port=5000)
