class GroupNotFoundError(Exception):
    pass


class GroupAlreadyExistsError(Exception):
    pass


class DocumentNotFoundError(Exception):
    pass


class ConversationNotFoundError(Exception):
    pass


class LightRAGNotReadyError(Exception):
    pass
