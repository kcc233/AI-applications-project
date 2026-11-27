let startButton = document.getElementById("startButton");
let box = document.getElementById("box");
const gameArea = document.getElementById("gameArea");
let scoreText = document.getElementById("score");
let bestscoreText = document.getElementById("best");
let message = document.getElementById("message");
let timerText = document.getElementById("timer");
let beepSound = document.getElementById("beep-sound");
let jokeText = document.getElementById("jokeText");
let gameTimer;
let timerInterval;
let timeLeft = 15;
let score = 0;
let bestScore = localStorage.getItem("bestScore") || 0;
let jokeRequest;


bestscoreText.textContent = bestScore;


startButton.addEventListener("click", function () {

  timeLeft = 15;
  score = 0;
  scoreText.textContent = 0;
  box.style.display = "block";
  message.textContent = "Click the mole!";
  timerText.textContent = timeLeft;

  

  getJoke();
  moveBox(); 
  clearTimeout(gameTimer);
  clearInterval(timerInterval);

  timerInterval = setInterval(function () {
    timeLeft--;
    timerText.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);

  gameTimer = setTimeout(function () {
    box.style.display = "none";
    message.textContent = "Game over! Your score was " + score + "!";

    if (score > bestScore) {
      bestScore = score;
      bestscoreText.textContent = bestScore;
      localStorage.setItem("bestScore", bestScore);
      message.textContent = "Congratulations! You beat your high score! Your new score is " + score + "!";
    }
  }, 15000);

});

box.addEventListener("click", function () {
  score++;
  scoreText.textContent = score;
  moveBox();
  playBeep();
});

function moveBox() {
  const maxLeft = Math.max(0, gameArea.clientWidth - box.offsetWidth);
  const maxTop = Math.max(0, gameArea.clientHeight - box.offsetHeight);
  box.style.left = Math.floor(Math.random() * (maxLeft + 1)) + "px";
  box.style.top = Math.floor(Math.random() * (maxTop + 1)) + "px";
}

new ResizeObserver(() => {
  if (box.style.display !== "block") return;
  const maxLeft = Math.max(0, gameArea.clientWidth - box.offsetWidth);
  const maxTop = Math.max(0, gameArea.clientHeight - box.offsetHeight);
  box.style.left = Math.min(box.offsetLeft, maxLeft) + "px";
  box.style.top = Math.min(box.offsetTop, maxTop) + "px";
}).observe(gameArea);

function playBeep() {
    beepSound.currentTime = 0;
    beepSound.play();
  }


async function getJoke() {
  jokeRequest?.abort();
  const request = new AbortController();
  jokeRequest = request;
  jokeText.textContent = "Loading joke...";

  try {
    const response = await fetch(
      "https://official-joke-api.appspot.com/random_joke",
      { signal: request.signal }
    );
    if (!response.ok) throw new Error("Joke unavailable");
    const data = await response.json();
    jokeText.textContent = data.setup + " " + data.punchline;
  } catch {
    if (!request.signal.aborted) {
      jokeText.textContent = "Why did the mole start an arcade? It wanted to go underground.";
    }
  }
}



