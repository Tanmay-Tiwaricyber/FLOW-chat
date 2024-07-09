document.addEventListener('DOMContentLoaded', (event) => {
    const gifButton = document.getElementById('gifButton');
    const gifSearchContainer = document.getElementById('gifSearchContainer');
    const gifSearchInput = document.getElementById('gifSearchInput');
    const gifResults = document.getElementById('gifResults');
    const messages = document.getElementById('messages');
    const GIPHY_API_KEY = '5kyTX22hzkWp9YQj5mLiUzrJucZEHjg7'; // Replace 'YOUR_API_KEY' with your actual Giphy API key

    gifButton.addEventListener('click', () => {
        gifSearchContainer.classList.toggle('hidden');
    });

    gifSearchInput.addEventListener('input', () => {
        const query = gifSearchInput.value;
        fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=10`)
            .then(response => response.json())
            .then(data => {
                gifResults.innerHTML = '';
                data.data.forEach(gif => {
                    const img = document.createElement('img');
                    img.src = gif.images.fixed_height.url;
                    img.addEventListener('click', () => {
                        const imgTag = `<img src="${gif.images.fixed_height.url}" alt="GIF">`;
                        const message = document.createElement('div');
                        message.classList.add('message');
                        message.innerHTML = imgTag;
                        messages.appendChild(message);
                        gifSearchContainer.classList.add('hidden');
                    });
                    gifResults.appendChild(img);
                });
            });
    });
});
