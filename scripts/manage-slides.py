#!/usr/bin/env python3
"""
Slide Management Script

Manages slide additions and deletions with automatic renumbering and git-aware
file operations for Slidev presentations.

Usage:
    python manage-slides.py delete <position> [--renumber]
    python manage-slides.py add <position> --title "Slide Title" [--layout default] [--renumber]
    python manage-slides.py renumber

Exit Codes:
    0: Success
    1: General error
    2: Invalid arguments
    3: Slide not found
    4: Git operation failed
"""

import argparse
import os
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

        Returns slides in the order they appear, preserving any gaps in numbering.

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

    def detect_gaps(self, slides: List[Slide], ignore_beginning: bool = True) -> List[int]:
        """
        Detect gaps in slide numbering

        Args:
            slides: List of slides
            ignore_beginning: If True, ignore gaps before the second slide
                            (e.g., slide 1 then slide 5 is OK, but gaps in middle are not)

        Returns:
            List of missing slide numbers (empty if no gaps)
        """
        if not slides or len(slides) < 2:
            return []

        slide_numbers = sorted([s.number for s in slides])

        if ignore_beginning:
            # Start checking from the second slide
            # This allows slide 1 (title) then slide 5 (first content)
            start_num = slide_numbers[1]
        else:
            start_num = slide_numbers[0]

        max_num = slide_numbers[-1]

        # Find gaps from second slide onwards
        existing = set(slide_numbers)
        expected = set(range(start_num, max_num + 1))
        gaps = sorted(expected - existing)

        return gaps

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

    def verify_postconditions(self, expected_count: int, allow_gaps: bool = False):
        """
        Verify postconditions after operation

        Args:
            expected_count: Expected number of slides
            allow_gaps: If True, don't fail on numbering gaps

        Raises:
            Exception: If verification fails
        """
        # Reparse slides.md
        new_slides = self.parse_slides_md()

        # Check count
        if len(new_slides) != expected_count:
            raise Exception(f"Slide count mismatch: expected {expected_count}, got {len(new_slides)}")

        # Verify numbering sequence (warn about gaps but don't fail if allow_gaps=True)
        gaps = self.detect_gaps(new_slides)
        if gaps and not allow_gaps:
            raise Exception(f"Numbering gaps detected at positions: {gaps}")
        elif gaps:
            print(f"Warning: Numbering gaps exist at positions: {gaps}", file=sys.stderr)
            print(f"Tip: Run 'manage-slides.py renumber' to fix gaps", file=sys.stderr)

        # Verify all files exist
        for slide in new_slides:
            filepath = self.slides_md.parent / slide.src
            if not filepath.exists():
                raise Exception(f"Missing file: {filepath}")

    def delete_slide(self, position: int, renumber: bool = False):
        """
        Delete slide at position

        Args:
            position: Position in list to delete (1-indexed, NOT slide number)
                     Example: If you have slides [1, 5, 6, 7], position 2 refers to slide 5
                     (the second slide in the list), not slide number 2
            renumber: If True, renumber all slides after deletion to close gaps
        """
        # Validate preconditions
        slides = self.validate_preconditions('delete', position)
        target_slide = slides[position - 1]

        print(f"Deleting slide at position {position}")
        print(f"  Slide number: {target_slide.number}")
        print(f"  Title: {target_slide.title}")
        print(f"  File: {target_slide.src}")

        # Backup state
        self.backup_state()

        try:
            # Get the file to delete
            target_file = self.slides_md.parent / target_slide.src

            # Remove target slide from list
            slides.pop(position - 1)

            if renumber:
                # Renumber ALL slides to be sequential (1, 2, 3, ...)
                print("\nRenumbering all slides to close gaps...")
                for i, slide in enumerate(slides):
                    new_num = i + 1
                    old_path = self.slides_md.parent / slide.src

                    # Parse old filename
                    match = re.match(r'slides/(\d+)-(.+)\.md', slide.src)
                    if not match:
                        raise Exception(f"Invalid filename format: {slide.src}")

                    old_num = int(match.group(1))
                    slug = match.group(2)

                    if old_num != new_num:
                        new_filename = f"{new_num:02d}-{slug}.md"
                        new_path = self.slides_dir / new_filename

                        print(f"  {old_path.name} -> {new_path.name}")
                        self.move_file(old_path, new_path)

                        # Update slide object
                        slide.number = new_num
                        slide.src = f"slides/{new_filename}"

            # Rebuild slides.md
            self.rebuild_slides_md(slides)

            # Delete target file (after slides.md is updated)
            if target_file.exists():
                if self.is_git_tracked(target_file):
                    subprocess.run(['git', 'rm', str(target_file)], check=True, cwd=self.slides_md.parent)
                else:
                    target_file.unlink()

            # Verify postconditions (allow gaps if not renumbering)
            self.verify_postconditions(len(slides), allow_gaps=(not renumber))

            # Cleanup backup
            if self.backup_file:
                self.backup_file.unlink()

            print(f"\n✓ Successfully deleted slide")
            if renumber:
                print(f"✓ Renumbered all slides sequentially")
            else:
                # Check for gaps
                gaps = self.detect_gaps(slides)
                if gaps:
                    print(f"\n⚠ Warning: Numbering gaps exist at positions: {gaps}")
                    print(f"Tip: Use --renumber flag to fix gaps automatically")

        except Exception as e:
            print(f"Error during deletion: {e}", file=sys.stderr)
            self.rollback()
            sys.exit(ExitCode.GENERAL_ERROR)

    def add_slide(self, position: int, title: str, layout: str = 'default', renumber: bool = False):
        """
        Add slide at position

        Args:
            position: Position to insert new slide (1-indexed list position, NOT slide number)
                     Example: If you have slides [1, 5, 6, 7], position 2 means insert
                     after slide 1 (before slide 5), becoming the new second slide
            title: New slide title
            layout: Slidev layout (default: 'default')
            renumber: If True, renumber all slides after insertion to be sequential
        """
        # Validate preconditions
        slides = self.validate_preconditions('add', position)

        # Determine the slide number for the new slide
        if renumber or not slides:
            # If renumbering, use position as slide number
            new_slide_num = position
        else:
            # If not renumbering, find a suitable slide number
            # Insert at position, use a number that fits
            if position == 1:
                # Insert at beginning
                new_slide_num = slides[0].number if slides else 1
            elif position > len(slides):
                # Insert at end
                new_slide_num = slides[-1].number + 1 if slides else 1
            else:
                # Insert in middle - use next available number after previous slide
                prev_slide_num = slides[position - 2].number if position > 1 else 0
                next_slide_num = slides[position - 1].number

                # Find gap or use next number
                if next_slide_num - prev_slide_num > 1:
                    new_slide_num = prev_slide_num + 1
                else:
                    new_slide_num = next_slide_num

        slug = self.generate_slug(title)
        new_filename = f"{new_slide_num:02d}-{slug}.md"
        new_filepath = self.slides_dir / new_filename

        print(f"Adding slide at position {position}")
        print(f"  Slide number: {new_slide_num}")
        print(f"  Title: {title}")
        print(f"  File: slides/{new_filename}")
        print(f"  Layout: {layout}")

        # Backup state
        self.backup_state()

        try:
            # Create new slide file
            print(f"\nCreating new slide: {new_filepath}")
            self.create_slide_file(new_filepath, title, layout)

            # Insert new slide into list
            new_slide = Slide(number=new_slide_num, src=f"slides/{new_filename}", title=title)
            slides.insert(position - 1, new_slide)

            if renumber:
                # Renumber ALL slides to be sequential (1, 2, 3, ...)
                print("\nRenumbering all slides to be sequential...")
                for i, slide in enumerate(slides):
                    new_num = i + 1
                    old_path = self.slides_md.parent / slide.src

                    # Parse old filename
                    match = re.match(r'slides/(\d+)-(.+)\.md', slide.src)
                    if not match:
                        raise Exception(f"Invalid filename format: {slide.src}")

                    old_num = int(match.group(1))
                    slug_part = match.group(2)

                    if old_num != new_num:
                        new_filename_renumber = f"{new_num:02d}-{slug_part}.md"
                        new_path = self.slides_dir / new_filename_renumber

                        print(f"  {old_path.name} -> {new_path.name}")
                        self.move_file(old_path, new_path)

                        # Update slide object
                        slide.number = new_num
                        slide.src = f"slides/{new_filename_renumber}"

            # Rebuild slides.md
            self.rebuild_slides_md(slides)

            # Verify postconditions (allow gaps if not renumbering)
            self.verify_postconditions(len(slides), allow_gaps=(not renumber))

            # Cleanup backup
            if self.backup_file:
                self.backup_file.unlink()

            print(f"\n✓ Successfully added slide at position {position}")
            if renumber:
                print(f"✓ Renumbered all slides sequentially")
            else:
                # Check for gaps
                gaps = self.detect_gaps(slides)
                if gaps:
                    print(f"\n⚠ Warning: Numbering gaps exist at positions: {gaps}")
                    print(f"Tip: Use --renumber flag to fix gaps automatically")

        except Exception as e:
            print(f"Error during addition: {e}", file=sys.stderr)
            self.rollback()
            sys.exit(ExitCode.GENERAL_ERROR)

    def renumber_all(self):
        """
        Renumber all slides to close middle gaps while preserving beginning gap

        Preserves the gap between slide 1 and slide 2 (typical: title at 1, content at 5+)
        but fixes any gaps in the middle sequence.

        Example:
            Before: [1, 5, 6, 9, 10] (gap at beginning: 1->5, gap in middle: 6->9)
            After:  [1, 5, 6, 7, 8]  (beginning gap preserved, middle gap fixed)
        """
        # Parse current slides
        slides = self.parse_slides_md()

        if not slides:
            print("No slides found", file=sys.stderr)
            sys.exit(ExitCode.SLIDE_NOT_FOUND)

        # Check for gaps (ignore beginning gap)
        gaps = self.detect_gaps(slides, ignore_beginning=True)
        if not gaps:
            print("No gaps detected in middle. Slides are properly numbered.")
            print("(Beginning gap between slides 1 and 2 is preserved as designed)")
            return

        print(f"Detected gaps in middle at positions: {gaps}")
        print(f"Renumbering {len(slides)} slides to close middle gaps...")
        print(f"(Preserving gap between slide 1 and slide 2)")

        # Backup state
        self.backup_state()

        try:
            # Preserve first slide number
            # Start sequential numbering from second slide onwards
            if len(slides) >= 2:
                first_slide_num = slides[0].number
                second_slide_num = slides[1].number

                print(f"\nPreserving beginning gap: slide {first_slide_num} -> slide {second_slide_num}")

                # Keep first slide unchanged
                # Renumber slides 2-N sequentially from second slide's number
                for i, slide in enumerate(slides):
                    if i == 0:
                        # Keep first slide number unchanged
                        new_num = first_slide_num
                    else:
                        # Sequential from second slide's number onwards
                        new_num = second_slide_num + (i - 1)

                    old_path = self.slides_md.parent / slide.src

                    # Parse old filename
                    match = re.match(r'slides/(\d+)-(.+)\.md', slide.src)
                    if not match:
                        raise Exception(f"Invalid filename format: {slide.src}")

                    old_num = int(match.group(1))
                    slug = match.group(2)

                    if old_num != new_num:
                        new_filename = f"{new_num:02d}-{slug}.md"
                        new_path = self.slides_dir / new_filename

                        print(f"  {old_path.name} -> {new_path.name}")
                        self.move_file(old_path, new_path)

                        # Update slide object
                        slide.number = new_num
                        slide.src = f"slides/{new_filename}"
            else:
                # Only one slide, keep it unchanged
                print("Only one slide found, no renumbering needed")

            # Rebuild slides.md
            self.rebuild_slides_md(slides)

            # Verify postconditions (allow beginning gap)
            # Check for middle gaps only
            new_gaps = self.detect_gaps(slides, ignore_beginning=True)
            if new_gaps:
                raise Exception(f"Middle gaps still exist after renumbering: {new_gaps}")

            # Cleanup backup
            if self.backup_file:
                self.backup_file.unlink()

            print(f"\n✓ Successfully renumbered all slides")
            if len(slides) >= 2:
                print(f"✓ Slides: {slides[0].number}, {slides[1].number}-{slides[-1].number} (beginning gap preserved)")
            else:
                print(f"✓ Slide: {slides[0].number}")

        except Exception as e:
            print(f"Error during renumbering: {e}", file=sys.stderr)
            self.rollback()
            sys.exit(ExitCode.GENERAL_ERROR)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Manage Slidev presentation slides with automatic renumbering',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Delete slide 5 (leaves gaps):
    python manage-slides.py delete 5

  Delete slide 5 and renumber all slides:
    python manage-slides.py delete 5 --renumber

  Add slide at position 3:
    python manage-slides.py add 3 --title "Architecture Overview"

  Add slide with custom layout and renumber:
    python manage-slides.py add 7 --title "Code Example" --layout two-cols --renumber

  Fix all gaps in slide numbering:
    python manage-slides.py renumber
        """
    )

    parser.add_argument(
        'operation',
        choices=['add', 'delete', 'renumber'],
        help='Operation to perform'
    )
    parser.add_argument(
        'position',
        type=int,
        nargs='?',
        help='Slide position (1-indexed, not required for renumber operation)'
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
    parser.add_argument(
        '--renumber',
        action='store_true',
        help='Renumber all slides after operation to close gaps (for add/delete)'
    )

    args = parser.parse_args()

    # Validate arguments
    if args.operation == 'add' and not args.title:
        parser.error("--title is required for add operation")

    if args.operation in ['add', 'delete'] and args.position is None:
        parser.error(f"position is required for {args.operation} operation")

    if args.operation == 'renumber' and args.position is not None:
        parser.error("position is not used for renumber operation")

    # Find slides.md
    slides_md = Path.cwd() / 'slides.md'
    if not slides_md.exists():
        print("Error: slides.md not found in current directory", file=sys.stderr)
        sys.exit(ExitCode.SLIDE_NOT_FOUND)

    # Create manager and execute operation
    import os  # Import here for validate_preconditions
    manager = SlideManager(slides_md)

    if args.operation == 'delete':
        manager.delete_slide(args.position, renumber=args.renumber)
    elif args.operation == 'add':
        manager.add_slide(args.position, args.title, args.layout, renumber=args.renumber)
    elif args.operation == 'renumber':
        manager.renumber_all()

    sys.exit(ExitCode.SUCCESS)


if __name__ == '__main__':
    main()
