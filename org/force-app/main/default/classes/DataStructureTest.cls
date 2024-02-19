public class DataStructureTest {
    public Integer[] sortedNumbers(Integer[] values) {
        // Implement sorting without using Salesforce standart sort
        return values;
    }

    public Integer duplicatesCount(Integer[] values) {
        // Implement duplicate counter
        return 0;
    }

    public boolean duplicatesExist(Integer[] values) {
        // Implement duplicate checker
        return false;
    }

    class Persons {
        String name0;
        Integer number0;
        String name1;
        Integer number1;
        String name2;
        Integer number2;
        String name3;
        Integer number3;
    }
    // A method to test the developer's ability to refactor variable names into a list
    public String personsInfo(Persons personsInstance) {
        String info = '';
        info += personsInstance.name0 +  'has number: ' + personsInstance.number0 + '\n';
        info += personsInstance.name1 +  'has number: ' + personsInstance.number1 + '\n';
        info += personsInstance.name2 +  'has number: ' + personsInstance.number2 + '\n';
        info += personsInstance.name3 +  'has number: ' + personsInstance.number3;

        return info;
    }

}