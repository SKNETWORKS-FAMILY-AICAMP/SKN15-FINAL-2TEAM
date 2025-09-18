import os

def rename_files(folder_path: str, old_keyword: str, new_team_name: str, remove_list: list = None):
    """
    folder_path : 바꿀 파일들이 있는 폴더 경로
    old_keyword : 기존 파일명에 들어있는 문자열 (예: "팀명")
    new_team_name : LeCun
    remove_list : 파일명에서 지울 문자열 리스트 (예: ["복사본", "temp"])
    """
    for filename in os.listdir(folder_path):
        new_filename = filename

        # 1) 불필요한 문자열 제거
        if remove_list:
            for word in remove_list:
                new_filename = new_filename.replace(word, "")

        # 2) old_keyword → new_team_name 치환
        if old_keyword in new_filename:
            new_filename = new_filename.replace(old_keyword, new_team_name)

        # 파일명이 바뀐 경우에만 실행
        if new_filename != filename:
            old_path = os.path.join(folder_path, filename)
            new_path = os.path.join(folder_path, new_filename)
            
            os.rename(old_path, new_path)
            print(f"{filename} ==> {new_filename}")

# 사용 예시
folder = "./docs"          # 폴더 경로
old_word = "팀명"                  # 기존 포함된 문자열
team = "LeCun"                    # 바꿀 팀명
remove_words = ["[양식 참고용] ", "[양식] "]  # 지울 문자열 리스트

rename_files(folder, old_word, team, remove_words)
