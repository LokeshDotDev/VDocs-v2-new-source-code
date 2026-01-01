import os
import zipfile

def is_valid_docx(path):
    try:
        with zipfile.ZipFile(path, 'r') as zf:
            return zf.testzip() is None
    except zipfile.BadZipFile:
        return False

def find_corrupted_docx(directory):
    corrupted = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.docx'):
                path = os.path.join(root, file)
                if not is_valid_docx(path):
                    corrupted.append(path)
    return corrupted

def main():
    folder = input('Enter the path to your DOCX directory: ').strip()
    corrupted = find_corrupted_docx(folder)
    if corrupted:
        print('Corrupted DOCX files:')
        for path in corrupted:
            print(path)
        confirm = input('Delete these files? (y/n): ').strip().lower()
        if confirm == 'y':
            for path in corrupted:
                os.remove(path)
            print('Corrupted files deleted.')
        else:
            print('No files deleted.')
    else:
        print('No corrupted DOCX files found.')

if __name__ == '__main__':
    main()
