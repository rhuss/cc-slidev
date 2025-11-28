#!/usr/bin/env python3
"""
Slide Management Script

Manages slide additions and deletions with automatic renumbering and git-aware
file operations for Slidev presentations.

Usage:
    python manage-slides.py delete <position>
    python manage-slides.py add <position> --title "Slide Title" [--layout default]

Exit Codes:
    0: Success
    1: General error
    2: Invalid arguments
    3: Slide not found
    4: Git operation failed
"""

import argparse
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


class ExitCode:
    """Exit code constants"""
    SUCCESS = 0
    GENERAL_ERROR = 1
    INVALID_ARGS = 2
    SLIDE_NOT_FOUND = 3
    GIT_ERROR = 4


@dataclass
class Slide:
    """Represents a slide entry from slides.md"""
    number: int
    src: str
    title: str


class SlideManager:
    """Manages slide file operations with git awareness and automatic renumbering"""

    def __init__(self, slides_md_path: Path):
        self.slides_md = slides_md_path
        self.slides_dir = slides_md_path.parent / "slides"
        self.backup_file: Optional[Path] = None
        self.moved_files: List[tuple[Path, Path]] = []  # For rollback
        self.created_files: List[Path] = []  # For rollback

    def parse_slides_md(self) -> List[Slide]:
        """
        Extract slide entries from slides.md

        Returns:
            List of Slide objects with number, src path, and title
        """
        slides = []
        current_src = None
        in_block = False

        with open(self.slides_md, 'r') as f:
            for line in f:
                line = line.rstrip()
                if line == '---':
                    in_block = not in_block
                elif in_block and line.startswith('src:'):
                    # Extract src path, remove leading './'
                    current_src = line.split(':', 1)[1].strip().lstrip('./')
                elif match := re.match(r'<!--\s*Slide\s+(\d+):\s*(.+?)\s*-->', line):
                    number = int(match.group(1))
                    title = match.group(2)
                    if current_src:
                        slides.append(Slide(number, current_src, title))
                    current_src = None

        return slides

    def is_git_tracked(self, filepath: Path) -> bool:
        """
        Check if a file is tracked by git

        Args:
            filepath: Path to check

        Returns:
            True if file is git-tracked, False otherwise
        """
        try:
            subprocess.run(
                ['git', 'ls-files', '--error-unmatch', str(filepath)],
                check=True,
                capture_output=True,
                cwd=self.slides_md.parent
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def move_file(self, src: Path, dest: Path):
        """
        Move file with git awareness

        Args:
            src: Source path
            dest: Destination path

        Raises:
            subprocess.CalledProcessError: If git mv fails
            Exception: If regular move fails
        """
        try:
            if self.is_git_tracked(src):
                subprocess.run(
                    ['git', 'mv', str(src), str(dest)],
                    check=True,
                    capture_output=True,
                    cwd=self.slides_md.parent
                )
            else:
                shutil.move(str(src), str(dest))

            self.moved_files.append((src, dest))  # Track for rollback
        except subprocess.CalledProcessError as e:
            print(f"Git move failed: {e.stderr.decode()}", file=sys.stderr)
            raise
        except Exception as e:
            print(f"Move failed: {e}", file=sys.stderr)
            raise

    def backup_state(self):
        """Backup slides.md before modifications"""
        import time
        self.backup_file = self.slides_md.with_suffix(f'.md.backup.{int(time.time())}')
        shutil.copy(self.slides_md, self.backup_file)

    def rollback(self):
        """Rollback all changes on error"""
        print("Rolling back changes...", file=sys.stderr)

        # Restore slides.md
        if self.backup_file and self.backup_file.exists():
            shutil.move(self.backup_file, self.slides_md)

        # Undo file moves (reverse order)
        for src, dest in reversed(self.moved_files):
            if dest.exists():
                try:
                    # Move back without git (rollback scenario)
                    shutil.move(str(dest), str(src))
                except Exception as e:
                    print(f"Warning: Failed to rollback move {dest} -> {src}: {e}", file=sys.stderr)

        # Remove created files
        for filepath in self.created_files:
            if filepath.exists():
                try:
                    filepath.unlink()
                except Exception as e:
                    print(f"Warning: Failed to remove {filepath}: {e}", file=sys.stderr)

    def generate_slug(self, title: str) -> str:
        """
        Generate kebab-case slug from title

        Args:
            title: Slide title

        Returns:
            Slug string (max 40 chars)
        """
        slug = title.lower()
        # Replace non-alphanumeric with hyphens
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        # Remove leading/trailing hyphens
        slug = slug.strip('-')
        # Limit to 40 characters
        return slug[:40].rstrip('-')

    def create_slide_file(self, filepath: Path, title: str, layout: str = 'default'):
        """
        Create new slide file with template

        Args:
            filepath: Path for new slide file
            title: Slide title
            layout: Slidev layout (default: 'default')
        """
        content = f"""---
layout: {layout}
---

# {title}

Content here

<!--
Presenter notes
-->
"""
        filepath.write_text(content)
        self.created_files.append(filepath)

    def rebuild_slides_md(self, slides: List[Slide]):
        """
        Rebuild slides.md with updated slide list

        Args:
            slides: List of Slide objects to write
        """
        # Read original to preserve global frontmatter
        with open(self.slides_md, 'r') as f:
            lines = f.readlines()

        # Find where global frontmatter ends (second ---)
        global_frontmatter = []
        separator_count = 0
        for i, line in enumerate(lines):
            global_frontmatter.append(line)
            if line.strip() == '---':
                separator_count += 1
                if separator_count == 2:
                    break

        # Write new slides.md
        with open(self.slides_md, 'w') as f:
            # Write global frontmatter
            f.writelines(global_frontmatter)

            # Write slide entries
            for slide in slides:
                f.write('\n')
                f.write('---\n')
                f.write(f'src: ./{slide.src}\n')
                f.write('---\n')
                f.write(f'<!-- Slide {slide.number}: {slide.title} -->\n')

    def validate_preconditions(self, operation: str, position: int) -> List[Slide]:
        """
        Validate preconditions before operation

        Args:
            operation: 'add' or 'delete'
            position: Slide position

        Returns:
            List of current slides

        Raises:
            SystemExit: If validation fails
        """
        # Check slides.md exists
        if not self.slides_md.exists():
            print(f"Error: slides.md not found at {self.slides_md}", file=sys.stderr)
            sys.exit(ExitCode.SLIDE_NOT_FOUND)

        # Check slides/ directory exists
        if not self.slides_dir.exists():
            print(f"Error: slides/ directory not found at {self.slides_dir}", file=sys.stderr)
            sys.exit(ExitCode.SLIDE_NOT_FOUND)

        # Check write permissions
        if not os.access(self.slides_md, os.W_OK):
            print(f"Error: No write permission for {self.slides_md}", file=sys.stderr)
            sys.exit(ExitCode.GENERAL_ERROR)

        # Parse slides
        slides = self.parse_slides_md()

        if not slides:
            print("Error: No slides found in slides.md", file=sys.stderr)
            sys.exit(ExitCode.SLIDE_NOT_FOUND)

        # Validate position range
        if operation == 'delete':
            if position < 1 or position > len(slides):
                print(f"Error: Position must be 1-{len(slides)}", file=sys.stderr)
                sys.exit(ExitCode.INVALID_ARGS)
        elif operation == 'add':
            if position < 1 or position > len(slides) + 1:
                print(f"Error: Position must be 1-{len(slides) + 1}", file=sys.stderr)
                sys.exit(ExitCode.INVALID_ARGS)

        # Check max slides limit
        if operation == 'add' and len(slides) >= 99:
            print("Error: Maximum 99 slides supported. Consider splitting presentation.", file=sys.stderr)
            sys.exit(ExitCode.INVALID_ARGS)

        return slides

    def verify_postconditions(self, expected_count: int):
        """
        Verify postconditions after operation

        Args:
            expected_count: Expected number of slides

        Raises:
            Exception: If verification fails
        """
        # Reparse slides.md
        new_slides = self.parse_slides_md()

        # Check count
        if len(new_slides) != expected_count:
            raise Exception(f"Slide count mismatch: expected {expected_count}, got {len(new_slides)}")

        # Verify numbering sequence (no gaps)
        for i, slide in enumerate(new_slides):
            expected_num = i + 1
            if slide.number != expected_num:
                raise Exception(f"Numbering gap at position {i + 1}: expected {expected_num}, got {slide.number}")

        # Verify all files exist
        for slide in new_slides:
            filepath = self.slides_md.parent / slide.src
            if not filepath.exists():
                raise Exception(f"Missing file: {filepath}")

    def delete_slide(self, position: int):
        """
        Delete slide at position and renumber subsequent slides

        Args:
            position: Slide number to delete (1-indexed)
        """
        # Validate preconditions
        slides = self.validate_preconditions('delete', position)
        target_slide = slides[position - 1]

        print(f"Deleting slide {position}: {target_slide.title}")
        print(f"File: {target_slide.src}")

        # Backup state
        self.backup_state()

        try:
            # Renumber files from position+1 to end
            for i in range(position, len(slides)):
                slide = slides[i]
                old_path = self.slides_md.parent / slide.src

                # Parse old number from filename
                match = re.match(r'slides/(\d+)-(.+)\.md', slide.src)
                if not match:
                    raise Exception(f"Invalid filename format: {slide.src}")

                old_num = int(match.group(1))
                slug = match.group(2)
                new_num = old_num - 1

                new_filename = f"{new_num:02d}-{slug}.md"
                new_path = self.slides_dir / new_filename

                print(f"Renumbering: {old_path.name} -> {new_path.name}")
                self.move_file(old_path, new_path)

                # Update slide object
                slides[i].number = new_num
                slides[i].src = f"slides/{new_filename}"

            # Remove target slide from list
            slides.pop(position - 1)

            # Rebuild slides.md
            self.rebuild_slides_md(slides)

            # Verify postconditions
            self.verify_postconditions(len(slides))

            # Cleanup backup
            if self.backup_file:
                self.backup_file.unlink()

            print(f"Successfully deleted slide {position}")
            print(f"Renumbered {len(slides) - position + 1} slides")

        except Exception as e:
            print(f"Error during deletion: {e}", file=sys.stderr)
            self.rollback()
            sys.exit(ExitCode.GENERAL_ERROR)

    def add_slide(self, position: int, title: str, layout: str = 'default'):
        """
        Add slide at position and renumber subsequent slides

        Args:
            position: Position to insert new slide (1-indexed)
            title: New slide title
            layout: Slidev layout (default: 'default')
        """
        # Validate preconditions
        slides = self.validate_preconditions('add', position)

        slug = self.generate_slug(title)
        new_filename = f"{position:02d}-{slug}.md"
        new_filepath = self.slides_dir / new_filename

        print(f"Adding slide at position {position}: {title}")
        print(f"File: slides/{new_filename}")
        print(f"Layout: {layout}")

        # Backup state
        self.backup_state()

        try:
            # Renumber files from END to position (reverse order to prevent collisions)
            for i in range(len(slides) - 1, position - 1, -1):
                slide = slides[i]
                old_path = self.slides_md.parent / slide.src

                # Parse old number from filename
                match = re.match(r'slides/(\d+)-(.+)\.md', slide.src)
                if not match:
                    raise Exception(f"Invalid filename format: {slide.src}")

                old_num = int(match.group(1))
                slug_part = match.group(2)
                new_num = old_num + 1

                new_filename_temp = f"{new_num:02d}-{slug_part}.md"
                new_path = self.slides_dir / new_filename_temp

                print(f"Renumbering: {old_path.name} -> {new_path.name}")
                self.move_file(old_path, new_path)

                # Update slide object
                slides[i].number = new_num
                slides[i].src = f"slides/{new_filename_temp}"

            # Create new slide file
            print(f"Creating new slide: {new_filepath}")
            self.create_slide_file(new_filepath, title, layout)

            # Insert new slide into list
            new_slide = Slide(number=position, src=f"slides/{new_filename}", title=title)
            slides.insert(position - 1, new_slide)

            # Rebuild slides.md
            self.rebuild_slides_md(slides)

            # Verify postconditions
            self.verify_postconditions(len(slides))

            # Cleanup backup
            if self.backup_file:
                self.backup_file.unlink()

            print(f"Successfully added slide at position {position}")
            if position <= len(slides) - 1:
                print(f"Renumbered {len(slides) - position} subsequent slides")

        except Exception as e:
            print(f"Error during addition: {e}", file=sys.stderr)
            self.rollback()
            sys.exit(ExitCode.GENERAL_ERROR)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Manage Slidev presentation slides with automatic renumbering',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Delete slide 5:
    python manage-slides.py delete 5

  Add slide at position 3:
    python manage-slides.py add 3 --title "Architecture Overview"

  Add slide with custom layout:
    python manage-slides.py add 7 --title "Code Example" --layout two-cols
        """
    )

    parser.add_argument(
        'operation',
        choices=['add', 'delete'],
        help='Operation to perform'
    )
    parser.add_argument(
        'position',
        type=int,
        help='Slide position (1-indexed)'
    )
    parser.add_argument(
        '--title',
        help='Slide title (required for add operation)'
    )
    parser.add_argument(
        '--layout',
        default='default',
        help='Slidev layout (default: default)'
    )

    args = parser.parse_args()

    # Validate arguments
    if args.operation == 'add' and not args.title:
        parser.error("--title is required for add operation")

    # Find slides.md
    slides_md = Path.cwd() / 'slides.md'
    if not slides_md.exists():
        print("Error: slides.md not found in current directory", file=sys.stderr)
        sys.exit(ExitCode.SLIDE_NOT_FOUND)

    # Create manager and execute operation
    import os  # Import here for validate_preconditions
    manager = SlideManager(slides_md)

    if args.operation == 'delete':
        manager.delete_slide(args.position)
    elif args.operation == 'add':
        manager.add_slide(args.position, args.title, args.layout)

    sys.exit(ExitCode.SUCCESS)


if __name__ == '__main__':
    main()
