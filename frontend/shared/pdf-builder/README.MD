# pdf-builder
A library to create and download a pdf document.

## Usage
- Create a PDFKit.PDFDocument and put it in a PdfDocWrapper
- Create instances of classes that implement the PdfItem interface (such as PdfText, Logo, LabelWithValue, VerticalStack, HorizontalGrid, ...)
- Create an instance of the PdfRenderer
- Call the render method of the PdfRenderer: pass the PdfDocWrapper and the pdf items to the method.
- The method returns a DownloadablePdf. Call the method download and pass a title for the document to download the pdf.

## Create a custom PdfItem
Create a class that implements the PdfItem interface. Implement each method: draw, getHeight, getWidth, getFonts.

### draw
The implementation of this method should draw something on the document. The PdfDocWrapper is passed to this method.
Optionally a position (x and y) and a max width are passed to this method. The position determines where the item should be drawn.
By default the item should be drawn on the current position (unless the item should have a fixed position such as a logo).

## getHeight
Returns the height if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.

## getWidth
Returns the width if the item would be drawn on the document. The return value of this function should be independent of external PdfItems such as a parent item. It can be dependent on child items.

## getFonts (optional)
Returns the fonts that should be registered before drawing the item.

## VerticalStack
A group of pdf items to be drawn vertically.
This makes it possible to set a max width or to split the stack if necessary (for example if they are passed to a HorizontalGrid).

## HorizontalGrid
Draws the child items in columns from left to right with the specified number of columns, columnGap, rowGap and width.
It is possible to pass a single VerticalStack: the stack will be splitted automatically. This way the vertical stack will be drawn in columns starting from the top until the end of the page, from left to right (if the end of the page is reached the item in the stack will be drawn in the next column).
