# Keyboard shortcuts

The UI is built keyboard-first. Press ++question++ in the app for the same
reference (the in-app overlay shows OS-appropriate modifier keys).

| Key | Action |
|---|---|
| ++arrow-right++ / ++j++ / ++n++ | Next chunk (without marking viewed) |
| ++arrow-left++ / ++k++ / ++p++ | Previous chunk |
| ++cmd+arrow-right++ / ++cmd+arrow-left++ (++ctrl++ on Windows/Linux) | Next / previous **unviewed** chunk (skips viewed ones) |
| ++enter++ | On the overview: begin review. On a chunk: mark viewed and advance |
| ++escape++ | Mark chunk unread (or close an open modal) |
| ++f++ | Flag / unflag the chunk |
| ++c++ | Focus the comment box |
| ++a++ | Focus the Ask-AI input |
| ++cmd+enter++ | Save the comment (while in the comment box) |
| ++question++ | Toggle the help overlay |

Two deliberate design choices:

- Plain letters only fire **without a modifier**, so browser combos like
  ++cmd+c++, ++cmd+f++, and ++cmd+a++ keep working normally.
- Shortcuts are ignored while you're typing in a text field, so ++j++ in a
  comment types a `j`.
