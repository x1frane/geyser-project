from flask import Flask, render_template

app = Flask(__name__)


@app.route
def index():
   return render_template('index.html')
















if app == '__main__':
    app.rum(debug=True)

