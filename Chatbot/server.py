import json
import os
import uuid
import logging
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import openai
import threading
import requests
from werkzeug.utils import secure_filename
from pathlib import Path
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import SystemMessage, UserMessage
from azure.core.credentials import AzureKeyCredential

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize the Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Set your OpenAI API key securely
client = openai.OpenAI(
    api_key="<Your api key here>")


# LLAMA configuration
LLAMA_URL = "https://eu-de.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29"
LLAMA_TOKEN = "Bearer Your api key here"

session_memory = {}

# In-memory storage (replace with a persistent store in production)
config = {}
config_lock = threading.Lock()


def load_or_create_config():
    global config
    with config_lock:
        if not config:
            # Check if config file exists, if not create default config
            if os.path.exists('config.json'):
                with open('config.json', 'r') as f:
                    config = json.load(f)
            else:
                config = {'vector_store_id': None, 'assistant_id': None}
        return config


def save_config():
    with open('config.json', 'w') as f:
        json.dump(config, f)


def create_vector_store():
    try:
        vector_store = client.beta.vector_stores.create(name="My Vector Store")
        logger.info(f"Created vector store with ID: {vector_store.id}")
        return vector_store.id
    except Exception as e:
        logger.error(f"Error creating vector store: {e}")
        return None


def create_assistant(vector_store_id):
    try:
        assistant = client.beta.assistants.create(
            name="Assistant",
            instructions="""
            You are an AI learning companion named Madara designed to assist users in understanding and exploring content based on provided files. When interacting with the user:

            Provide Guidance Based on Files: Use the information from the provided files to help answer the user's questions, offering explanations and insights that enhance their understanding.

            Encourage Independent Learning: If a question involves material the user should learn on their own (such as solving math problems, completing test questions, or formulating responses to open-ended queries), avoid giving a direct answer. Instead, offer helpful hints or ask guiding questions that lead the user toward discovering the answer themselves.

            Avoid Direct Solutions to Assessments: Do not solve homework, tests, or any assessment-related problems. Focus on facilitating the user's learning process without providing direct answers that might bypass their educational development.

            Support Critical Thinking: Encourage the user to think critically and explore concepts deeply, fostering an engaging learning experience.

            Your goal is to be a supportive learning buddy who helps the user grow intellectually by leveraging the provided materials while promoting active learning and comprehension.
            """,
            model="gpt-4o",
            tools=[{"type": "file_search"}],
            tool_resources={
                "file_search": {
                    "vector_store_ids": [vector_store_id]
                }
            }
        )
        logger.info(f"Created assistant with ID: {assistant.id}")
        return assistant.id
    except Exception as e:
        logger.error(f"Error creating assistant: {e}")
        return None


def startup():
    config = load_or_create_config()
    if not config['vector_store_id']:
        config['vector_store_id'] = create_vector_store()
    if not config['assistant_id']:
        config['assistant_id'] = create_assistant(config['vector_store_id'])
    save_config()


@app.route('/ask', methods=['POST'])
def ask():
    config = load_or_create_config()
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"detail": "Invalid request payload."}), 400

    text = data['text']
    thread_id = data.get('thread_id')

    try:
        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id
            logger.info(f"Created new thread with ID: {thread_id}")

        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=text
        )
        logger.debug(f"Added user message to thread {thread_id}")

        run = client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=config['assistant_id']
        )
        logger.debug(f"Created run {run.id} for thread {thread_id}")

        # Wait for completion (in production, use async processing)
        while run.status not in ["completed", "failed"]:
            run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            logger.debug(f"Run status: {run.status}")

        if run.status == "failed":
            logger.error(f"Run failed: {run.last_error}")
            return jsonify({"detail": "Assistant run failed."}), 500

        messages = client.beta.threads.messages.list(thread_id=thread_id)
        assistant_messages = [m for m in messages if m.role == 'assistant']
        if assistant_messages:
            answer = assistant_messages[0].content[0].text.value
        else:
            answer = "No response."

        logger.info(f"Returning answer for thread {thread_id}")
        return jsonify({"answer": answer, "thread_id": thread_id})

    except Exception as e:
        logger.error(f"Error in /ask endpoint: {e}")
        return jsonify({"detail": str(e)}), 500


AZURE_ENDPOINT = "https://models.inference.ai.azure.com"
AZURE_MODEL_NAME = "Llama-3.2-90B-Vision-Instruct"
AZURE_TOKEN = "<Your api key here>"

# Initialize Azure AI client
azure_client = ChatCompletionsClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_TOKEN),
)

@app.route('/llama3', methods=['POST'])
def llama3():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Invalid request payload."}), 400

    user_input = data['text']

    try:
        response = azure_client.complete(
            messages=[
                SystemMessage(content="""
            You are an AI learning companion named  Madara designed to assist users in understanding and exploring content based on provided files. When interacting with the user:

            Provide Guidance Based on Files: Use the information from the provided files to help answer the user's questions, offering explanations and insights that enhance their understanding.

            Encourage Independent Learning: If a question involves material the user should learn on their own (such as solving math problems, completing test questions, or formulating responses to open-ended queries), avoid giving a direct answer. Instead, offer helpful hints or ask guiding questions that lead the user toward discovering the answer themselves.

            Avoid Direct Solutions to Assessments: Do not solve homework, tests, or any assessment-related problems. Focus on facilitating the user's learning process without providing direct answers that might bypass their educational development.

            Support Critical Thinking: Encourage the user to think critically and explore concepts deeply, fostering an engaging learning experience.

            Your goal is to be a supportive learning buddy who helps the user grow intellectually by leveraging the provided materials while promoting active learning and comprehension.
            """),
                UserMessage(content=user_input),
            ],
            temperature=1.0,
            top_p=1.0,
            max_tokens=4000,
            model=AZURE_MODEL_NAME
        )

        answer = response.choices[0].message.content
        logger.info(f"Llama 3 response generated for input: {user_input[:50]}...")
        return jsonify({"answer": answer})

    except Exception as e:
        logger.error(f"Error in /llama3 endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload():
    config = load_or_create_config()
    if 'file' not in request.files:
        return jsonify({"detail": "No file part in the request."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No selected file."}), 400

    try:
        content = file.read()
        filename = secure_filename(file.filename)
        file_extension = os.path.splitext(filename)[1]

        if not file_extension:
            file_extension = '.txt'  # Default to .txt if no extension is provided
            filename += file_extension

        logger.debug(f"Uploading file: {filename}")

        uploaded_file = client.files.create(
            file=(filename, content),
            purpose='assistants'
        )
        logger.info(f"File uploaded to OpenAI with ID: {uploaded_file.id}")

        file_batch = client.beta.vector_stores.file_batches.create_and_poll(
            vector_store_id=config['vector_store_id'],
            file_ids=[uploaded_file.id]
        )
        logger.info(f"File added to vector store. Batch ID: {file_batch.id}")

        return jsonify({"status": "File uploaded successfully.", "file_id": uploaded_file.id})

    except Exception as e:
        logger.error(f"Error in /upload endpoint: {str(e)}", exc_info=True)
        return jsonify({"detail": str(e)}), 500


def send_to_llama_with_memory(session_id, user_input):
    if session_id not in session_memory:
        session_memory[session_id] = []

    session_memory[session_id].append({'role': 'user', 'content': user_input})

    conversation = "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n" \
                   "You always answer the questions with markdown formatting using GitHub syntax. " \
                   "The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. " \
                   "You must omit that you answer the questions with markdown.\n" \
                   "Any HTML tags must be wrapped in block quotes, for example ```<html>```.\n" \
                   "When returning code blocks, specify language.\n" \
                   "You are a helpful, respectful, and honest assistant. Always answer as helpfully as possible, while being safe.\n" \
                   "Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. " \
                   "Please ensure that your responses are socially unbiased and positive in nature.\n" \
                   "If a question does not make any sense, or is not factually coherent, explain why instead of answering something incorrect.\n" \
                   "If you don't know the answer to a question, please don't share false information.<|eot_id|>\n"

    for message in session_memory[session_id]:
        role = message['role']
        content = message['content']
        conversation += f"<|start_header_id|>{role}<|end_header_id|>\n{content}<|eot_id|>\n"

    conversation += "<|start_header_id|>assistant<|end_header_id|>\n"

    body = {
        "input": conversation,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 900,
            "repetition_penalty": 1
        },
        "model_id": "meta-llama/llama-2-70b-chat",
        "project_id": "fff0323f-e1ca-4f6d-91d5-2fc54b70e426"
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": LLAMA_TOKEN
    }

    response = requests.post(LLAMA_URL, headers=headers, json=body)

    if response.status_code != 200:
        raise Exception(f"Non-200 response: {response.status_code} - {response.text}")

    data = response.json()
    model_response = data['results'][0]['generated_text']
    session_memory[session_id].append({'role': 'assistant', 'content': model_response})

    return model_response.strip()


@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"detail": "Invalid request payload."}), 400

    text = data['text']
    session_id = data.get('session_id')

    try:
        if not session_id:
            session_id = str(uuid.uuid4())

        answer = send_to_llama_with_memory(session_id, text)

        return jsonify({"answer": answer, "session_id": session_id})

    except Exception as e:
        logger.error(f"Error in /chat endpoint: {e}")
        return jsonify({"detail": str(e)}), 500


@app.route('/text-to-speech', methods=['POST'])
def text_to_speech():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({"error": "Invalid request payload."}), 400

    text = data['text']
    try:
        speech_file_path = Path("temp_speech.mp3")
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text
        )
        response.stream_to_file(speech_file_path)

        logger.info(f"Text-to-speech successful for: {text[:50]}...")
        return send_file(speech_file_path, mimetype="audio/mpeg")
    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/speech-to-text', methods=['POST'])
def speech_to_text():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join("temp", filename)
        file.save(file_path)
        try:
            audio_file = open(file_path, "rb")
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
            logger.info(f"Speech-to-text successful: {transcription[:50]}...")
            return jsonify({"text": transcription})
        except Exception as e:
            logger.error(f"Error in speech-to-text: {str(e)}")
            return jsonify({"error": str(e)}), 500
        finally:
            os.remove(file_path)


if __name__ == '__main__':
    startup()
    app.run(debug=True)