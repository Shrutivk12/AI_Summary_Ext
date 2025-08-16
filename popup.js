document.getElementById("summarize").addEventListener("click", () => {
    const result = document.getElementById("result");
    const summaryType = document.getElementById("summary-type").value;

    result.textContent = "Extracting text...";

    //Get user's api key
    chrome.storage.sync.get(["geminiApiKey"], ({geminiApiKey}) => {
        if(!geminiApiKey){
            result.textContent = "No API key set, click the gear icon to add one.";
            return;
        }
        //content.js -> page text
        chrome.tabs.query({active:true,currentWindow:true}, ([tab]) =>{
            if (!tab || !tab.id) {
                result.textContent = "No active tab found.";
                return;
            }

            chrome.tabs.sendMessage(
                tab.id,
                { type: "GET_ARTICLE_TEXT" },
                async(response) => {
                    if (chrome.runtime.lastError) {
                        result.textContent = "Please reload the page";
                        return;
                    }
                    if (!response) {
                        result.textContent = "No response from content script.";
                        return;
                    }
                    const { text } = response;
                    if (!text) {
                        result.textContent = "Couldn't extract text from this page.";
                        return;
                    }
                    //Send text to gemini and get summary
                    try {
                        const summary = await getGeminiSummary(text, summaryType, geminiApiKey);
                        result.textContent = summary;
                    } catch (error) {
                        result.textContent = "Gemini Error: " + error.message;
                    }
                }
            );
        });
    });
});

async function getGeminiSummary(rawText, type, apiKey){
    const max = 20000;
    const text = rawText.length > max ? rawText.slice(0, max)+ "..." : rawText;

    const promptMap = {
        brief: `Summarize in 2 to 3 sentences:\n\n${text}`,
        detailed: `Give a detailed summary:\n\n${text}`,
        bullets: `Summarize in 5 to 7 bullet points (start each line with "- "):\n\n${text}`
    }

    const prompt = promptMap[type] || promptMap.brief;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                contents: [{parts: [{text: prompt}]}],
                generationConfig: {temperature: 0.2}
            })
        }
    )

    if(!res.ok) {
        const {error} = await res.json();
        throw new Error(error?.message || "Requset failed");
    }

    const data = await res.json();
    // console.log(data);
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary";
}

document.getElementById("copy-btn").addEventListener("click", () => {
    const text = document.getElementById("result").innerText;
    if(!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("copy-btn");
        const old = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = old), 2000);
    })
})