import {create, Text, Wrapper} from './createElement'
import {Timeline, Animation} from './animation'
import {ease} from './cubicBezier'
import {enableGesture} from './gesture'

export class Carousel {
    constructor(config) {
        this.children = [];
        this.attributes = new Map()
        this.properties = new Map()
    }

    set class(v) {//property
        console.log("Parent::class", v)
    }

    setAttribute(name, val) {
        this[name] = val
    }

    appendChild(child) {
        this.children.push(child)
    }

    render() {
        let position = 0
        const timeline = new Timeline
        timeline.start()

        let nextStopHandler = null

        let children = this.data.map((url, currentPosition) => {
            let lastPosition = (currentPosition - 1 + this.data.length) % this.data.length
            let nextPosition = (currentPosition + 1) % this.data.length

            let offset = 0

            const onStart = () => {
                timeline.pause()
                clearTimeout(nextStopHandler)
                const currentEl = children[currentPosition]
                let currentTransformValue = Number(currentEl.style.transform.match(/translateX\(([\s\S]+)px\)/)[1])
                offset = currentTransformValue + 500 * currentPosition

            }
            const onPan = e => {
                const event = e.detail
                let lastEl = children[lastPosition]
                let currentEl = children[currentPosition]
                let nextEl = children[nextPosition]
                let dx = event.clientX - event.startX

                let currentTransformValue = -500 * currentPosition + offset + dx
                let lastTransformValue = -500 - 500 * lastPosition + offset + dx
                let nextTransformValue = 500 - 500 * nextPosition + offset + dx

                currentEl.style.transform = `translateX(${currentTransformValue}px)`
                lastEl.style.transform = `translateX(${lastTransformValue}px)`
                nextEl.style.transform = `translateX(${nextTransformValue}px)`
            }

            const onPanend = e => {
                let direction = 0
                const dx = e.detail.clientX - e.detail.startX
                if (dx + offset > 250) {
                    direction = 1
                } else if (dx + offset < -250) {
                    direction = -1
                }
                timeline.reset()
                timeline.start()

                let lastEl = children[lastPosition]
                let currentEl = children[currentPosition]
                let nextEl = children[nextPosition]

                let currentTransformValue = -500 * currentPosition + offset + dx
                let lastTransformValue = -500 - 500 * lastPosition + offset + dx
                let nextTransformValue = 500 - 500 * nextPosition + offset + dx

                let lastAnimation = new Animation(
                    lastEl.style,
                    'transform',
                    -500 - 500 * lastPosition + offset + dx,
                    -500 - 500 * lastPosition + direction * 500,
                    500,
                    0,
                    ease,
                    v => `translateX(${v}px)`
                )
                let currentAnimation = new Animation(
                    currentEl.style,
                    'transform',
                    -500 * currentPosition + offset + dx,
                    -500 * currentPosition + direction * 500,
                    500,
                    0,
                    ease,
                    v => `translateX(${v}px)`
                )
                let nextAnimation = new Animation(
                    nextEl.style,
                    'transform',
                    500 - 500 * nextPosition + offset + dx,
                    500 - 500 * nextPosition + direction * 500,
                    500,
                    0,
                    ease,
                    v => `translateX(${v}px)`
                )
                timeline.add(lastAnimation)
                timeline.add(currentAnimation)
                timeline.add(nextAnimation)

                // 自动播放
                position = (position - direction + this.data.length) % this.data.length
                nextStopHandler = setTimeout(next, 3000);
            }

            const onFlick = e => {//todo flick
                console.log("flick")
            }

            let element = <img src={url} onStart={onStart} onPan={onPan} onPanend={onPanend} onFlick={onFlick} enableGesture={true} />
            element.style.transform = 'translateX(0px)';
            element.addEventListener('dragstart', e => e.preventDefault())
            return element
        })

        const next = () => {
            const nextPosition = (position + 1) % this.data.length;
            const currentNode = children[position]
            const nextNode = children[nextPosition]

            let currentAnimation = new Animation(currentNode.style, 'transform', -100 * position, -100 - 100 * position, 500, 0, ease, v => `translateX(${5 * v}px)`)
            let nextAnimation = new Animation(nextNode.style, 'transform', 100 - 100 * nextPosition, -100 * nextPosition, 500, 0, ease, v => `translateX(${5 * v}px)`)

            timeline.add(currentAnimation)
            timeline.add(nextAnimation)
            position = nextPosition

            nextStopHandler = setTimeout(next, 3000);
        }

        nextStopHandler = setTimeout(next, 3000);

        let root = (
            <div class="carousel">
                {children}
            </div>
        )
        return root
    }

    mountTo(parent) {
        this.render().mountTo(parent)
    }
}