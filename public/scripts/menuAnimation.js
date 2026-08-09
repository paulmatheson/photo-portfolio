export function menuAnimation(toggle) {
    const slideNav = document.getElementById("slideNav")
    const sideBarLinks = document.getElementById("sidebar-links")
    const socialIcons = document.getElementById("socialIcons")

    toggle.classList.toggle("change");

    slideNav.classList.toggle("navSlide")
    slideNav.classList.toggle('bring-forward')
    slideNav.classList.toggle('bring-backward')

    sideBarLinks.classList.toggle("fade-in")
    socialIcons.classList.toggle("fade-in")

    document.body.classList.toggle('no-scroll')
    if (document.body.classList.contains('no-scroll')) {
        document.querySelector('main').style.opacity = 0;
    } else {
        document.querySelector('main').style.opacity = 100;
    }
}