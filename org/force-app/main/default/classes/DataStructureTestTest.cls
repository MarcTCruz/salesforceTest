@isTest
private class DataStructureTestTest{
    static public List<Integer> generateRandomIntegers(Integer length){
        List<Integer> sequence = new List<Integer>();
        for (Integer i = 0; i < length; i++){
            sequence.add((Integer) (Math.random() * 100)); // Generates a random integer between 0 and 99
        }
        return sequence;
    }

    static Integer[] selectSorteds(Integer[] arr){
        final Integer length = arr.size();
        for (Integer i = 0; i < length; ++i){
            Integer smallestUnorderedValueIndex = i;
            for (Integer j = i + 1; j < length; ++j){
                if (arr[smallestUnorderedValueIndex] > arr[j]){
                    smallestUnorderedValueIndex = j;
                }
            }
            Integer temp = arr[i];
            arr[i] = arr[smallestUnorderedValueIndex];
            arr[smallestUnorderedValueIndex] = temp;
        }

        return arr;
    }

    static void testSortArray(){
        DataStructureTest dt = new DataStructureTest();
        Integer[] arr = generateRandomIntegers(100);
        Integer[] expected = arr.clone();
        expected.sort();
        //System.assertEquals(expected, selectSorteds(arr.clone()), 'Incorrect selectSorteds result');
        System.assertEquals(expected, dt.sortedNumbers(arr), 'Incorrect sortedNumbers result');
    }

    @isTest
    static void testDuplicatesCountAndDuplicatesExist(){
        DataStructureTest dt = new DataStructureTest();
        Integer remainingTestsQuantity = 10;
        Boolean anyDuplicate = false;
        while(remainingTestsQuantity > 0 || anyDuplicate == false){
            Integer[] arr = generateRandomIntegers(100);
            testSortArray();
            Integer duplicateQuantity = arr.size() - (new Set<Integer>(arr)).size();
            Boolean currentAnyDuplicate = duplicateQuantity > 0;
            anyDuplicate = anyDuplicate || currentAnyDuplicate;

            System.assertEquals(duplicateQuantity, dt.duplicatesCount(arr), 'Incorrect duplicatesCount result');
            System.assertEquals(currentAnyDuplicate, dt.duplicatesExist(arr), 'Incorrect duplicatesExist result');
            remainingTestsQuantity--;
        }
    }

}