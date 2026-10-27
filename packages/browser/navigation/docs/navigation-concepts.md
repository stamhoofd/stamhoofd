# Concept of navigation (when to show, present, pop or dismiss)

## Navigating between views

You can navigate between views using four methods: show, present, pop, and dismiss, available via the `useShow`, `usePresent`  , `usePop` and `useDismiss` hooks.

Understanding the difference can be tricky at first.

#### NavigationController

Everything starts with a simple stack of views — this is called a **NavigationController**.

Here’s how it works:
- When you show a new view, it gets pushed onto the stack.
- When you hit the back button, we pop the last view from the stack, returning to the previous one.

#### **ModalStackComponent**

Most of the time, you’ll just use *show* and *pop* to move forward and backward within the same flow. These all operate on the **parent NavigationController** of your current view.

On top of the standard view stack, there’s also a **ModalStackComponent** — this sits at the root of your app and handles **modal navigation**.
- When you want to open something **on top of** your current view (like a popup), you use `present()`.
- When you're done with the modal, you use `dismiss()` to close it.

Behind the scenes, your modal contains just another NavigationController — meaning it also supports `show()` and `pop()` within the modal.

---

#### present / dismiss

Use `present` when you want to start a new flow, typically in a modal. The new view will appear on top of the current view, and users return by closing it (`dismiss`).

This is ideal for actions like editing something or displaying a popup.

[present.mov](assets/navigation-concepts/present.mov)

#### show / pop

Use `show` when you're navigating deeper into your app. This usually shows a new screen that slides in horizontally, and users return with a back button (`pop`).

[show.mov](assets/navigation-concepts/show.mov)

---

## Example

Let’s give an example of how the ‘stack’ works.

Horizontal movements on the sketch are show/pop navigations, while vertical movements represent present/dismiss.

### **Setup**

Imagine a calendar view with all your events. The stack of the app will look like this:

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView
		]
]
```

![](assets/navigation-concepts/calendar.png)

Visually, it will look like this:

![](assets/navigation-concepts/calendar.png)

### **→ Click on an event in the calendar (`show`)**

The EventView, which contains the details of the clicked event, will be pushed to the NavigationController.

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView,
			EventView
		]
]
```

![](assets/navigation-concepts/event-stack.png)

Visually, it will look like this:

![](assets/navigation-concepts/event-screen.png)

### **→ Click on registrations (`show`)**

You can continue this behaviour and push as many views as required.

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView,
			EventView,
			RegistrationsTableView
		]
]
```

![](assets/navigation-concepts/registrations-stack.png)

Visually, it will look like this:

![](assets/navigation-concepts/registrations-screen.png)

### **← Go back (`pop`)**

At some point, you’ll need to go back, so clicking the back button calls ‘pop’ and will remove the last item from the NavigationController’s stack.

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView,
			EventView
		]
]
```

![](assets/navigation-concepts/event-stack.png)

### **→ Click edit settings (`present`)**

Now, some navigation events will present a modal instead of showing views as previously shown. Like editing the settings of an event. This will present a modal. It is more intuitive to think of a modal like a popup - though sometimes it isn’t really a popup because there is not enough space for the shadows (like on mobile). So the display style (modalDisplayStyle) can be different. The stack will look like this:

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView,
			EventView
		],
		NavigationController [
			EditEventView
		]
]
```

![](assets/navigation-concepts/edit-event-stack.png)

You’ll notice that the model itself also is a NavigationController - this will allow us to push/show other views inside the modal.

Visually, this will look like this (depending whether you displayed it as a popup or not):

![](assets/navigation-concepts/edit-event-screen.png)

### **→ Edit a price (`show`)**

Now… Let’s say we ‘show’ something in a view inside the popup, like editing a price of the event. This is where you’ll start to see the power of the navigation framework. The EditEventView simply ‘shows’ the EditPriceView - it doesn’t need to know how to display it or that it is inside a popup.

```typescript
ModalStackComponent [
		NavigationController [
			CalendarView,
			EventView
		],
		NavigationController [
			EditEventView,
			EditPriceView
		]
]
```

![](assets/navigation-concepts/edit-price-stack.png)

Visually, this will look like this (depending whether you displayed the settings earlier as a popup or not):

![](assets/navigation-concepts/edit-price-screen.png)

For a user it is immediately clear that the close button will dismiss the `EditEventView` and `EditPriceView` at the same time, while the back button will only return to `EditEventView`.

---

## Usage

You can read how to actually use this concept in code, in [Navigation API’s](navigation-api.md)
