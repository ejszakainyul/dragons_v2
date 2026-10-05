function toggleInventory(show) {
    const modal = document.getElementById('inventoryModal');
    modal.style.display = show ? 'block' : 'none';
    if (show) history.pushState(null, null, '#inventory');
    else history.replaceState(null, null, ' ');
}

function confirmDelete(type, id) {
    if (confirm(`Biztosan törlöd a ${type === 'story' ? 'történetet' : 'sárkányt'}?`)) {
        window.location.href = `?type=${type}&id=${id}&delete=1${type === 'dragon' ? '&inventory=1' : ''}`;
    }
}

window.onhashchange = function() {
    if (window.location.hash === '#inventory') {
        toggleInventory(true);
    }
};

let currentStoryIndex = 0;
const stories = document.querySelectorAll('.story-card');
const totalStories = stories.length;

function initStories() {
    if (stories.length > 0) {
        stories[0].classList.add('active');
    }
}

function slideStory(direction) {
    const prevIndex = currentStoryIndex;
    currentStoryIndex = Math.max(0, Math.min(totalStories - 1, currentStoryIndex + direction));
    
    stories[prevIndex].classList.remove('active');
    stories[prevIndex].classList.add('prev');
    
    stories[currentStoryIndex].classList.add('active');
    updatePageIndicator();
}

function updatePageIndicator() {
    const indicator = document.querySelector('.page-indicator');
    if (indicator) {
        indicator.textContent = `(${currentStoryIndex + 1}/${totalStories})`;
    }
}

document.querySelectorAll('.page-arrow').forEach(arrow => {
    arrow.addEventListener('click', () => {
        const currentPage = <?= $dragon_page ?>;
        const newPage = currentPage + (arrow.classList.contains('prev') ? -1 : 1);
        if (newPage > 0 && newPage <= <?= $total_dragon_pages ?>) {
            window.location.href = `?dpage=${newPage}&inventory=1`;
        }
    });
});

document.querySelector('form').addEventListener('submit', () => {
    const newName = document.querySelector('[name="new_username"]').value;
    history.replaceState({}, '', `user.php?name=${encodeURIComponent(newName)}`);
});

document.addEventListener('DOMContentLoaded', () => {
    initStories();

    document.querySelectorAll('.dragon-card').forEach((card, i) => {
        card.style.setProperty('--i', i);
    });
});